#!/usr/bin/env python3
"""Strict, dependency-free validation for the checked-in PHAK content bundle."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

from phak_config import CHAPTERS, PROJECT_ROOT, SOURCE_EDITION, SOURCE_SHA256, SOURCE_URL


QUESTION_TYPES = {"multipleChoice", "numeric", "matching", "image"}
ACS_PATTERN = re.compile(r"^PA\.[IVX]+\.[A-Z]\.(?:K|R|S)\d+[a-z]?$", re.IGNORECASE)
PAGE_PATTERN = re.compile(r"^(?:\d{1,2}-\d{1,3})(?: to \d{1,2}-\d{1,3})?$")


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.ids: set[str] = set()
        self.question_types: Counter[str] = Counter()

    def require(self, condition: bool, message: str) -> None:
        if not condition:
            self.errors.append(message)

    def text(self, value, path: str, minimum: int = 1) -> None:
        self.require(isinstance(value, str) and len(value.strip()) >= minimum, f"{path}: text is missing or too short")

    def unique_id(self, value, path: str) -> None:
        self.text(value, path)
        if isinstance(value, str):
            self.require(value not in self.ids, f"{path}: duplicate id {value}")
            self.ids.add(value)

    def acs(self, codes, path: str) -> None:
        self.require(isinstance(codes, list) and len(codes) > 0, f"{path}: at least one ACS code is required")
        if isinstance(codes, list):
            for code in codes:
                self.require(isinstance(code, str) and bool(ACS_PATTERN.fullmatch(code)), f"{path}: invalid ACS code {code!r}")

    def citation(self, source, path: str, chapter_number: int | None = None) -> None:
        self.require(isinstance(source, dict), f"{path}: citation must be an object")
        if not isinstance(source, dict):
            return
        for field in ("handbook", "edition", "chapter", "page", "url"):
            self.text(source.get(field), f"{path}.{field}")
        self.require(source.get("edition") == SOURCE_EDITION, f"{path}: edition mismatch")
        self.require(source.get("url") == SOURCE_URL, f"{path}: source URL mismatch")
        self.require(isinstance(source.get("page"), str) and bool(PAGE_PATTERN.fullmatch(source["page"])), f"{path}: malformed printed page {source.get('page')!r}")
        if chapter_number is not None:
            self.require(source.get("chapter", "").startswith(f"Chapter {chapter_number} "), f"{path}: wrong chapter")

    def question(self, question, path: str, chapter_number: int | None = None) -> None:
        self.require(isinstance(question, dict), f"{path}: question must be an object")
        if not isinstance(question, dict):
            return
        self.unique_id(question.get("id"), f"{path}.id")
        kind = question.get("type")
        self.require(kind in QUESTION_TYPES, f"{path}: unsupported type {kind!r}")
        if kind in QUESTION_TYPES:
            self.question_types[kind] += 1
        self.text(question.get("prompt"), f"{path}.prompt", 12)
        self.text(question.get("explanation"), f"{path}.explanation", 20)
        self.citation(question.get("sourceCitation"), f"{path}.sourceCitation", chapter_number)
        self.acs(question.get("acsCodes"), f"{path}.acsCodes")

        if kind in {"multipleChoice", "image"}:
            options = question.get("options")
            self.require(isinstance(options, list) and len(options) >= 2, f"{path}: at least two options required")
            if isinstance(options, list):
                self.require(all(isinstance(option, str) and option.strip() for option in options), f"{path}: blank option")
                self.require(len(set(options)) == len(options), f"{path}: duplicate options")
                correct = question.get("correctIndex")
                self.require(isinstance(correct, int) and 0 <= correct < len(options), f"{path}: invalid correctIndex")
        if kind == "numeric":
            answer = question.get("answer")
            self.require(isinstance(answer, dict), f"{path}: numeric answer missing")
            if isinstance(answer, dict):
                self.require(isinstance(answer.get("value"), (int, float)), f"{path}: numeric value missing")
                self.require(isinstance(answer.get("tolerance"), (int, float)) and answer["tolerance"] >= 0, f"{path}: tolerance invalid")
                self.text(answer.get("unit"), f"{path}.answer.unit")
        if kind == "matching":
            pairs = question.get("pairs")
            self.require(isinstance(pairs, list) and len(pairs) >= 3, f"{path}: at least three matching pairs required")
            if isinstance(pairs, list):
                left_values, right_values = [], []
                for pair_index, pair in enumerate(pairs):
                    pair_path = f"{path}.pairs[{pair_index}]"
                    self.unique_id(pair.get("id") if isinstance(pair, dict) else None, f"{pair_path}.id")
                    if isinstance(pair, dict):
                        self.text(pair.get("left"), f"{pair_path}.left")
                        self.text(pair.get("right"), f"{pair_path}.right")
                        left_values.append(pair.get("left"))
                        right_values.append(pair.get("right"))
                self.require(len(set(left_values)) == len(left_values), f"{path}: duplicate left values")
                self.require(len(set(right_values)) == len(right_values), f"{path}: duplicate right values")
        if kind == "image":
            image = question.get("image")
            self.require(isinstance(image, dict), f"{path}: image metadata missing")
            if isinstance(image, dict):
                for field in ("uri", "alt", "caption", "sourcePage"):
                    self.text(image.get(field), f"{path}.image.{field}")
                uri = image.get("uri")
                if isinstance(uri, str):
                    asset = PROJECT_ROOT / uri
                    self.require(asset.is_file() and asset.stat().st_size > 50_000, f"{path}: missing or undersized image asset {uri}")


def validate(module: dict) -> Validation:
    result = Validation()
    for field in ("id", "title", "shortTitle", "description", "version"):
        result.text(module.get(field), f"module.{field}")
    result.unique_id(module.get("id"), "module.id")
    source = module.get("source")
    result.require(isinstance(source, dict), "module.source: object required")
    if isinstance(source, dict):
        result.require(source.get("url") == SOURCE_URL, "module.source.url mismatch")
        result.require(source.get("edition") == SOURCE_EDITION, "module.source.edition mismatch")
        result.require(source.get("checksum") == SOURCE_SHA256, "module.source.checksum mismatch")

    sections = module.get("sections")
    result.require(isinstance(sections, list) and len(sections) == 17, "module.sections: exactly 17 required")
    if isinstance(sections, list):
        result.require([section.get("order") for section in sections if isinstance(section, dict)] == list(range(1, 18)), "sections must be ordered 1 through 17")
        for section_index, section in enumerate(sections):
            path = f"sections[{section_index}]"
            chapter_number = section_index + 1
            result.require(isinstance(section, dict), f"{path}: object required")
            if not isinstance(section, dict):
                continue
            result.unique_id(section.get("id"), f"{path}.id")
            result.text(section.get("title"), f"{path}.title")
            result.text(section.get("summary"), f"{path}.summary", 30)
            result.text(section.get("sourcePages"), f"{path}.sourcePages")
            result.acs(section.get("acsCodes"), f"{path}.acsCodes")
            lessons = section.get("lessons")
            result.require(isinstance(lessons, list) and len(lessons) >= 3, f"{path}: at least three lessons required")
            if isinstance(lessons, list):
                result.require([lesson.get("order") for lesson in lessons if isinstance(lesson, dict)] == list(range(1, len(lessons) + 1)), f"{path}: lesson order invalid")
                for lesson_index, lesson in enumerate(lessons):
                    lesson_path = f"{path}.lessons[{lesson_index}]"
                    result.require(isinstance(lesson, dict), f"{lesson_path}: object required")
                    if not isinstance(lesson, dict):
                        continue
                    result.unique_id(lesson.get("id"), f"{lesson_path}.id")
                    for field, minimum in (("title", 3), ("concept", 30), ("explanation", 60), ("workedExample", 50)):
                        result.text(lesson.get(field), f"{lesson_path}.{field}", minimum)
                    result.require(isinstance(lesson.get("estimatedMinutes"), int) and 1 <= lesson["estimatedMinutes"] <= 5, f"{lesson_path}: estimatedMinutes must be 1..5")
                    result.citation(lesson.get("sourceCitation"), f"{lesson_path}.sourceCitation", chapter_number)
                    result.acs(lesson.get("acsCodes"), f"{lesson_path}.acsCodes")
                    result.question(lesson.get("practice"), f"{lesson_path}.practice", chapter_number)
            quiz = section.get("quiz")
            result.require(isinstance(quiz, list) and len(quiz) >= 3, f"{path}: at least three quiz questions required")
            if isinstance(quiz, list):
                quiz_types = set()
                for question_index, question in enumerate(quiz):
                    result.question(question, f"{path}.quiz[{question_index}]", chapter_number)
                    if isinstance(question, dict):
                        quiz_types.add(question.get("type"))
                result.require(len(quiz_types) >= 3, f"{path}: quiz must mix at least three question types")

    exam = module.get("exam")
    result.require(isinstance(exam, list) and len(exam) == 30, "module.exam: exactly 30 questions required")
    if isinstance(exam, list):
        for index, question in enumerate(exam):
            result.question(question, f"exam[{index}]")
        result.require({question.get("type") for question in exam if isinstance(question, dict)} == QUESTION_TYPES, "module.exam must include all four question types")

    glossary = module.get("glossary")
    result.require(isinstance(glossary, list) and len(glossary) >= 51, "module.glossary: at least 51 terms required")
    section_ids = {section.get("id") for section in sections if isinstance(section, dict)} if isinstance(sections, list) else set()
    if isinstance(glossary, list):
        for index, term in enumerate(glossary):
            path = f"glossary[{index}]"
            result.unique_id(term.get("id") if isinstance(term, dict) else None, f"{path}.id")
            if isinstance(term, dict):
                result.text(term.get("term"), f"{path}.term")
                result.text(term.get("definition"), f"{path}.definition", 20)
                result.require(term.get("sectionId") in section_ids, f"{path}: invalid sectionId")
                result.citation(term.get("sourceCitation"), f"{path}.sourceCitation")
                result.acs(term.get("acsCodes"), f"{path}.acsCodes")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", nargs="?", type=Path, default=PROJECT_ROOT / "src" / "content" / "phak.json")
    args = parser.parse_args()
    module = json.loads(args.bundle.read_text(encoding="utf-8"))
    result = validate(module)
    if result.errors:
        print(f"Validation failed with {len(result.errors)} error(s):")
        for error in result.errors:
            print(f"- {error}")
        return 1
    print(
        "PHAK bundle valid: "
        f"17 sections, 51 lessons, 68 section questions, 30 exam questions, "
        f"51 glossary terms; question types {dict(sorted(result.question_types.items()))}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

