#!/usr/bin/env python3
"""Strict validation for the checked-in four-module curriculum catalog."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path

from catalog_seed import MODULE_SPECS


ROOT = Path(__file__).resolve().parents[2]
FIGURE_SOURCES = json.loads((ROOT / "assets" / "figure-sources.json").read_text())
QUESTION_TYPES = {"multipleChoice", "numeric", "matching", "image"}
ACS_PATTERN = re.compile(r"^PA\.[IVX]+\.[A-Z]\.(?:K|R|S)\d+[a-z]?$", re.IGNORECASE)
PAGE_PATTERN = re.compile(r"^(?:\d{1,2}-\d{1,3}|[A-Z]-\d{1,3})(?: to (?:\d{1,2}-\d{1,3}|[A-Z]-\d{1,3}))?$")
EXPECTED = {
    "phak": (26, 123, 104, 30, 78),
    "afh": (20, 98, 80, 30, 60),
    "awh": (35, 144, 140, 30, 105),
    "rmh": (8, 25, 32, 30, 24),
}
ACS_ALLOWLIST = {
    "PA.I.A.K1", "PA.I.A.K2", "PA.I.B.K1", "PA.I.B.K2", "PA.I.C.K1", "PA.I.C.K2",
    "PA.I.C.K3", "PA.I.C.K4", "PA.I.C.R1", "PA.I.C.R2", "PA.I.D.K1", "PA.I.E.K1",
    "PA.I.E.K2", "PA.I.E.R1", "PA.I.F.K1", "PA.I.F.K2", "PA.I.F.K3", "PA.I.F.K4",
    "PA.I.F.R1", "PA.I.F.R2", "PA.I.G.K1", "PA.I.G.K2", "PA.I.H.K1", "PA.I.H.K2",
    "PA.I.H.K3", "PA.I.H.R1", "PA.I.H.R2", "PA.I.H.R3", "PA.III.A.K1", "PA.III.B.K1",
    "PA.III.C.K1", "PA.IX.C.K1", "PA.VI.A.K1", "PA.VI.A.K2", "PA.VII.A.K1",
    "PA.VII.B.K1", "PA.VII.B.K2", "PA.VIII.A.K1", "PA.VIII.A.K2",
}
GENERIC_QUESTION_FRAGMENTS = (
    "what is the sound operational use of",
    "delay action until the remaining safety margin is nearly gone",
    "rely on memory and disregard the published limitation or procedure",
    "treat the condition as unrelated to planning, aircraft control, or risk",
    "apply the handbook cues and controls for",
    "during a risk check, likelihood is 3 and severity is 4",
)
QUALITY_STOP_WORDS = {
    "about", "after", "before", "cited", "does", "each", "from", "handbook", "into",
    "lesson", "page", "passage", "source", "statement", "that", "their", "these", "this",
    "topic", "which", "with",
}
LEGACY_PHAK = json.loads((ROOT / "src" / "content" / "phak.json").read_text())
LEGACY_PHAK_PRACTICE_IDS = {
    lesson["practice"]["id"]
    for section in LEGACY_PHAK["sections"]
    for lesson in section["lessons"]
}
LEGACY_PHAK_QUIZ_IDS = {
    question["id"]
    for section in LEGACY_PHAK["sections"]
    for question in section["quiz"]
}


def normalized_text(value: object) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", str(value).lower()))


def quality_words(value: object) -> set[str]:
    return {
        word
        for word in re.findall(r"[a-z0-9]+", str(value).lower())
        if len(word) >= 4 and word not in QUALITY_STOP_WORDS
    }


def prompt_signature(prompt: object) -> str:
    return " ".join(re.findall(r"[a-z]+", str(prompt).lower())[:5])


def question_evidence(question: dict) -> str:
    kind = question.get("type")
    if kind in {"multipleChoice", "image"}:
        options = question.get("options", [])
        correct_index = question.get("correctIndex")
        correct = (
            options[correct_index]
            if isinstance(correct_index, int) and isinstance(options, list) and 0 <= correct_index < len(options)
            else ""
        )
        return f"{question.get('prompt', '')} {correct}"
    if kind == "matching":
        rights = " ".join(
            str(pair.get("right", ""))
            for pair in question.get("pairs", [])
            if isinstance(pair, dict)
        )
        return f"{question.get('prompt', '')} {rights}"
    return f"{question.get('prompt', '')} {question.get('explanation', '')}"


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
        self.require(isinstance(codes, list) and bool(codes), f"{path}: at least one ACS code is required")
        if isinstance(codes, list):
            for code in codes:
                self.require(isinstance(code, str) and bool(ACS_PATTERN.fullmatch(code)), f"{path}: invalid ACS code {code!r}")
                self.require(code in ACS_ALLOWLIST, f"{path}: ACS code is not in the pinned FAA-S-ACS-6C allowlist: {code!r}")

    def citation(self, citation, path: str, source) -> None:
        self.require(isinstance(citation, dict), f"{path}: citation must be an object")
        if not isinstance(citation, dict):
            return
        for field in ("handbook", "edition", "chapter", "page", "url"):
            self.text(citation.get(field), f"{path}.{field}")
        self.require(citation.get("handbook") == source.title, f"{path}: handbook mismatch")
        self.require(citation.get("edition") == source.edition, f"{path}: edition mismatch")
        self.require(citation.get("url") == source.url, f"{path}: source URL mismatch")
        self.require(isinstance(citation.get("page"), str) and bool(PAGE_PATTERN.fullmatch(citation["page"])), f"{path}: malformed printed page {citation.get('page')!r}")
        pdf_page = citation.get("pdfPage")
        self.require(isinstance(pdf_page, int) and 1 <= pdf_page <= source.page_count, f"{path}: invalid physical PDF page {pdf_page!r}")

    def question(self, question, path: str, module_id: str, section_ids: set[str], source) -> None:
        self.require(isinstance(question, dict), f"{path}: question must be an object")
        if not isinstance(question, dict):
            return
        self.unique_id(question.get("id"), f"{path}.id")
        self.require(question.get("moduleId") == module_id, f"{path}: module provenance mismatch")
        self.require(question.get("sectionId") in section_ids, f"{path}: invalid section provenance")
        kind = question.get("type")
        self.require(kind in QUESTION_TYPES, f"{path}: unsupported type {kind!r}")
        if kind in QUESTION_TYPES:
            self.question_types[kind] += 1
        self.text(question.get("prompt"), f"{path}.prompt", 12)
        self.text(question.get("explanation"), f"{path}.explanation", 20)
        self.citation(question.get("sourceCitation"), f"{path}.sourceCitation", source)
        self.acs(question.get("acsCodes"), f"{path}.acsCodes")
        if kind in {"multipleChoice", "image"}:
            options = question.get("options")
            self.require(isinstance(options, list) and len(options) >= 2, f"{path}: at least two options required")
            if isinstance(options, list):
                self.require(all(isinstance(option, str) and option.strip() for option in options), f"{path}: blank option")
                self.require(len(set(options)) == len(options), f"{path}: duplicate options")
                self.require(isinstance(question.get("correctIndex"), int) and 0 <= question["correctIndex"] < len(options), f"{path}: invalid correctIndex")
        if kind == "numeric":
            answer = question.get("answer")
            self.require(isinstance(answer, dict), f"{path}: numeric answer missing")
            if isinstance(answer, dict):
                self.require(isinstance(answer.get("value"), (int, float)), f"{path}: numeric value missing")
                self.require(isinstance(answer.get("tolerance"), (int, float)) and answer["tolerance"] >= 0, f"{path}: tolerance invalid")
                self.text(answer.get("unit"), f"{path}.answer.unit")
        if kind == "matching":
            pairs = question.get("pairs")
            self.require(isinstance(pairs, list) and len(pairs) >= 2, f"{path}: at least two matching pairs required")
            if isinstance(pairs, list):
                pair_ids = set()
                for index, pair in enumerate(pairs):
                    self.text(pair.get("id") if isinstance(pair, dict) else None, f"{path}.pairs[{index}].id")
                    if isinstance(pair, dict):
                        self.require(pair.get("id") not in pair_ids, f"{path}: duplicate pair id")
                        pair_ids.add(pair.get("id"))
                        self.text(pair.get("left"), f"{path}.pairs[{index}].left")
                        self.text(pair.get("right"), f"{path}.pairs[{index}].right")
        if kind == "image":
            image = question.get("image")
            self.require(isinstance(image, dict), f"{path}: image metadata missing")
            if isinstance(image, dict):
                for field in ("uri", "alt", "caption", "sourcePage"):
                    self.text(image.get(field), f"{path}.image.{field}")
                asset = ROOT / str(image.get("uri", ""))
                self.require(asset.is_file() and asset.stat().st_size > 50_000, f"{path}: missing or undersized image asset {image.get('uri')}")
                figure_source = FIGURE_SOURCES.get(str(image.get("uri", "")), {})
                self.require(
                    figure_source.get("moduleId") == module_id
                    and figure_source.get("pdfChecksum") == source.checksum
                    and figure_source.get("pdfPage") == question.get("sourceCitation", {}).get("pdfPage"),
                    f"{path}: figure source manifest does not match the cited PDF page",
                )


def validate_generated_question_quality(
    result: Validation,
    module_id: str,
    sections: list[dict],
    generated_practices: list[tuple[dict, dict, str]],
    generated_questions: list[tuple[dict, str]],
) -> None:
    section_by_id = {section["id"]: section for section in sections}
    prompt_counts = Counter(
        normalized_text(question.get("prompt")) for question, _ in generated_questions
    )
    repeated_prompts = [prompt for prompt, count in prompt_counts.items() if prompt and count > 1]
    result.require(
        not repeated_prompts,
        f"{module_id}: generated questions repeat {len(repeated_prompts)} normalized prompt(s)",
    )

    for question, path in generated_questions:
        prompt = str(question.get("prompt", ""))
        result.require(
            not re.search(r"[\"“]\s*\[Figure\s+\d", prompt, re.IGNORECASE),
            f"{path}: generated prompt contains an extracted figure label",
        )
        result.require(
            not re.search(r"[\"“]chapter\s+\d", prompt, re.IGNORECASE),
            f"{path}: generated prompt contains an extracted chapter header",
        )
        searchable = normalized_text(
            " ".join(
                [
                    str(question.get("prompt", "")),
                    str(question.get("explanation", "")),
                    *[str(option) for option in question.get("options", [])],
                    *[
                        str(pair.get("right", ""))
                        for pair in question.get("pairs", [])
                        if isinstance(pair, dict)
                    ],
                ]
            )
        )
        for fragment in GENERIC_QUESTION_FRAGMENTS:
            result.require(
                fragment not in searchable,
                f"{path}: generic generated-question language is forbidden: {fragment!r}",
            )

        section = section_by_id.get(question.get("sectionId"))
        if section:
            source_text = " ".join(
                f"{lesson.get('title', '')} {lesson.get('concept', '')} {lesson.get('explanation', '')}"
                for lesson in section["lessons"]
            )
            overlap = quality_words(question_evidence(question)) & quality_words(source_text)
            result.require(
                len(overlap) >= 4,
                f"{path}: question is not sufficiently grounded in its section's lesson text",
            )
            if question.get("type") in {"multipleChoice", "image"}:
                options = question.get("options", [])
                correct_index = question.get("correctIndex")
                if isinstance(options, list) and isinstance(correct_index, int) and 0 <= correct_index < len(options):
                    correct = normalized_text(options[correct_index])
                    lesson_titles = {
                        normalized_text(lesson.get("title", "")) for lesson in section["lessons"]
                    }
                    result.require(
                        correct not in lesson_titles,
                        f"{path}: correct answer must test source content, not identify a lesson title",
                    )

    if not generated_practices:
        return
    practice_questions = [question for question, _, _ in generated_practices]
    practice_prompt_counts = Counter(normalized_text(question["prompt"]) for question in practice_questions)
    result.require(
        max(practice_prompt_counts.values(), default=0) == 1,
        f"{module_id}: generated lesson-practice prompts must be unique",
    )

    stem_counts = Counter(prompt_signature(question["prompt"]) for question in practice_questions)
    maximum_stem_reuse = max(2, math.ceil(len(practice_questions) * 0.22))
    result.require(
        max(stem_counts.values(), default=0) <= maximum_stem_reuse,
        f"{module_id}: a lesson-practice stem is reused too often ({max(stem_counts.values(), default=0)} > {maximum_stem_reuse})",
    )

    choice_questions = [
        question for question in practice_questions if question.get("type") == "multipleChoice"
    ]
    option_sets = {
        tuple(sorted(normalized_text(option) for option in question["options"]))
        for question in choice_questions
    }
    distractor_sets = {
        tuple(
            sorted(
                normalized_text(option)
                for index, option in enumerate(question["options"])
                if index != question["correctIndex"]
            )
        )
        for question in choice_questions
    }
    required_distinct = math.floor(len(choice_questions) * 0.9)
    result.require(
        len(option_sets) >= required_distinct,
        f"{module_id}: lesson-practice option sets are too repetitive ({len(option_sets)} < {required_distinct})",
    )
    result.require(
        len(distractor_sets) >= required_distinct,
        f"{module_id}: lesson-practice distractor sets are too repetitive ({len(distractor_sets)} < {required_distinct})",
    )

    positions = Counter(question["correctIndex"] for question in choice_questions)
    result.require(
        set(positions) == {0, 1, 2, 3},
        f"{module_id}: generated correct answers must appear in all four positions",
    )
    result.require(
        max(positions.values(), default=0) <= math.ceil(len(choice_questions) * 0.45),
        f"{module_id}: generated correct-answer positions are too concentrated: {dict(positions)}",
    )

    for question, lesson, path in generated_practices:
        lesson_text = f"{lesson['title']} {lesson['concept']} {lesson['explanation']}"
        overlap = quality_words(question_evidence(question)) & quality_words(lesson_text)
        result.require(
            len(overlap) >= 4,
            f"{path}: lesson practice does not test the cited lesson content",
        )
        if question.get("type") == "multipleChoice":
            correct = question["options"][question["correctIndex"]]
            result.require(
                normalized_text(correct) != normalized_text(lesson["title"]),
                f"{path}: correct answer must test lesson content, not identify the lesson title",
            )


def validate_catalog(catalog: dict, coverage: dict) -> Validation:
    result = Validation()
    result.require(catalog.get("schemaVersion") == 2, "catalog.schemaVersion must be 2")
    result.text(catalog.get("catalogId"), "catalog.catalogId")
    result.text(catalog.get("contentVersion"), "catalog.contentVersion")
    modules = catalog.get("modules")
    result.require(isinstance(modules, list), "catalog.modules must be an array")
    if not isinstance(modules, list):
        return result
    result.require([module.get("id") for module in modules] == ["phak", "afh", "awh", "rmh"], "catalog module order must be PHAK, AFH, AWH, RMH")
    coverage_by_module = {module["moduleId"]: module for module in coverage.get("modules", [])}

    for module in modules:
        module_id = module.get("id")
        result.unique_id(module_id, f"modules[{module_id}].id")
        result.require(module_id in MODULE_SPECS, f"unknown module {module_id}")
        if module_id not in MODULE_SPECS:
            continue
        source, _ = MODULE_SPECS[module_id]
        result.require(module.get("version") == catalog.get("contentVersion"), f"{module_id}: version mismatch")
        metadata = module.get("source", {})
        result.require(metadata.get("url") == source.url, f"{module_id}: source URL mismatch")
        result.require(metadata.get("edition") == source.edition, f"{module_id}: source edition mismatch")
        result.require(metadata.get("checksum") == source.checksum, f"{module_id}: source checksum mismatch")
        sections = module.get("sections", [])
        section_ids = {section.get("id") for section in sections if isinstance(section, dict)}
        generated_practices: list[tuple[dict, dict, str]] = []
        generated_questions: list[tuple[dict, str]] = []
        expected_sections, expected_lessons, expected_quiz, expected_exam, expected_terms = EXPECTED[module_id]
        result.require(len(sections) == expected_sections, f"{module_id}: expected {expected_sections} sections")
        result.require([section.get("order") for section in sections] == list(range(1, expected_sections + 1)), f"{module_id}: section order is not contiguous")
        for section_index, section in enumerate(sections):
            path = f"{module_id}.sections[{section_index}]"
            result.unique_id(section.get("id"), f"{path}.id")
            result.text(section.get("title"), f"{path}.title")
            result.text(section.get("summary"), f"{path}.summary", 40)
            result.acs(section.get("acsCodes"), f"{path}.acsCodes")
            lessons = section.get("lessons", [])
            result.require(2 <= len(lessons) <= 6, f"{path}: expected 2..6 lessons")
            result.require([lesson.get("order") for lesson in lessons] == list(range(1, len(lessons) + 1)), f"{path}: lesson order invalid")
            for lesson_index, lesson in enumerate(lessons):
                lesson_path = f"{path}.lessons[{lesson_index}]"
                result.unique_id(lesson.get("id"), f"{lesson_path}.id")
                for field, minimum in (("title", 3), ("concept", 30), ("explanation", 60), ("workedExample", 80)):
                    result.text(lesson.get(field), f"{lesson_path}.{field}", minimum)
                result.citation(lesson.get("sourceCitation"), f"{lesson_path}.sourceCitation", source)
                result.acs(lesson.get("acsCodes"), f"{lesson_path}.acsCodes")
                result.question(lesson.get("practice"), f"{lesson_path}.practice", module_id, {section["id"]}, source)
                practice = lesson.get("practice")
                if isinstance(practice, dict) and (
                    module_id != "phak" or practice.get("id") not in LEGACY_PHAK_PRACTICE_IDS
                ):
                    generated_practices.append((practice, lesson, f"{lesson_path}.practice"))
                    generated_questions.append((practice, f"{lesson_path}.practice"))
            quiz = section.get("quiz", [])
            result.require(len(quiz) == 4, f"{path}: exactly four quiz questions required")
            for question_index, question in enumerate(quiz):
                question_path = f"{path}.quiz[{question_index}]"
                result.question(question, question_path, module_id, {section["id"]}, source)
                if isinstance(question, dict) and (
                    module_id != "phak" or question.get("id") not in LEGACY_PHAK_QUIZ_IDS
                ):
                    generated_questions.append((question, question_path))
            result.require(len({question.get("type") for question in quiz}) >= 3, f"{path}: quiz must use at least three interaction types")
            result.require(any(question.get("type") == "image" for question in quiz), f"{path}: quiz requires an image question")

        result.require(sum(len(section["lessons"]) for section in sections) == expected_lessons, f"{module_id}: lesson count mismatch")
        result.require(sum(len(section["quiz"]) for section in sections) == expected_quiz, f"{module_id}: section-question count mismatch")
        exam = module.get("exam", [])
        result.require(len(exam) == expected_exam, f"{module_id}: exam count mismatch")
        for index, question in enumerate(exam):
            question_path = f"{module_id}.exam[{index}]"
            result.question(question, question_path, module_id, section_ids, source)
            if isinstance(question, dict) and not (
                module_id == "phak"
                and str(question.get("prompt", "")).startswith("Cumulative source-image review:")
            ):
                generated_questions.append((question, question_path))
        result.require({question.get("type") for question in exam} == QUESTION_TYPES, f"{module_id}: exam must use all four interaction types")
        numeric_answers = [
            (question.get("answer", {}).get("value"), str(question.get("answer", {}).get("unit", "")).lower())
            for question in exam
            if question.get("type") == "numeric"
        ]
        result.require(
            len(numeric_answers) == len(set(numeric_answers)),
            f"{module_id}: numeric exam answers must not repeat the same value and unit",
        )
        section_prompts = {question["prompt"] for section in sections for question in section["quiz"]}
        result.require(not section_prompts.intersection(question["prompt"] for question in exam), f"{module_id}: exam prompts must not duplicate section prompts")
        validate_generated_question_quality(
            result,
            module_id,
            sections,
            generated_practices,
            generated_questions,
        )
        glossary = module.get("glossary", [])
        result.require(len(glossary) == expected_terms, f"{module_id}: glossary count mismatch")
        for index, term in enumerate(glossary):
            path = f"{module_id}.glossary[{index}]"
            result.unique_id(term.get("id"), f"{path}.id")
            result.require(term.get("moduleId") == module_id, f"{path}: module provenance mismatch")
            result.require(term.get("sectionId") in section_ids, f"{path}: invalid section provenance")
            result.text(term.get("term"), f"{path}.term")
            result.text(term.get("definition"), f"{path}.definition", 20)
            result.citation(term.get("sourceCitation"), f"{path}.sourceCitation", source)
            result.acs(term.get("acsCodes"), f"{path}.acsCodes")

        module_coverage = coverage_by_module.get(module_id, {})
        result.require(bool(module_coverage.get("appendices")), f"{module_id}: appendix disposition is missing")
        covered_sections = {item.get("sectionId") for item in module_coverage.get("sections", [])}
        result.require(covered_sections == section_ids, f"{module_id}: coverage matrix does not match catalog sections")
        covered_lessons = {lesson.get("lessonId") for item in module_coverage.get("sections", []) for lesson in item.get("lessons", [])}
        actual_lessons = {lesson["id"] for section in sections for lesson in section["lessons"]}
        result.require(covered_lessons == actual_lessons, f"{module_id}: coverage matrix does not match catalog lessons")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", nargs="?", type=Path, default=ROOT / "src" / "content" / "catalog.json")
    parser.add_argument("--coverage", type=Path, default=ROOT / "scripts" / "content" / "coverage.json")
    args = parser.parse_args()
    result = validate_catalog(json.loads(args.bundle.read_text()), json.loads(args.coverage.read_text()))
    if result.errors:
        print(f"Validation failed with {len(result.errors)} error(s):")
        for error in result.errors:
            print(f"- {error}")
        return 1
    print(f"Curriculum catalog valid: 4 modules, 89 sections, 390 lessons, 866 questions, 267 terms; question types {dict(sorted(result.question_types.items()))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
