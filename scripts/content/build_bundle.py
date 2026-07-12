#!/usr/bin/env python3
"""Generate src/content/phak.json from the reviewed editorial seed."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

from content_seed import SECTIONS
from phak_config import (
    CHAPTERS,
    PROJECT_ROOT,
    SOURCE_EDITION,
    SOURCE_SHA256,
    SOURCE_TITLE,
    SOURCE_URL,
)


def citation(chapter: dict, page: str) -> dict:
    return {
        "handbook": SOURCE_TITLE,
        "edition": SOURCE_EDITION,
        "chapter": f"Chapter {chapter['number']} - {chapter['title']}",
        "page": page,
        "url": SOURCE_URL,
    }


def build_question(question_id: str, chapter: dict, page: str, acs_codes: list[str], spec: dict) -> dict:
    kind = spec["kind"]
    question = {
        "id": question_id,
        "type": kind,
        "prompt": spec["prompt"],
        "explanation": spec["explanation"],
        "sourceCitation": citation(chapter, page),
        "acsCodes": acs_codes,
    }
    if kind == "multipleChoice":
        question["options"] = spec["options"]
        question["correctIndex"] = spec["correctIndex"]
    elif kind == "numeric":
        question["answer"] = spec["answer"]
    elif kind == "matching":
        question["pairs"] = [
            {"id": f"{question_id}-pair-{index}", "left": left, "right": right}
            for index, (left, right) in enumerate(spec["pairs"], start=1)
        ]
    else:
        raise ValueError(f"unsupported editorial question kind: {kind}")
    return question


def build_module() -> dict:
    chapter_by_number = {chapter["number"]: chapter for chapter in CHAPTERS}
    sections = []
    glossary = []

    for raw_section in SECTIONS:
        number = raw_section["number"]
        chapter = chapter_by_number[number]
        section_id = f"phak-section-{number:02d}"
        acs_codes = raw_section["acsCodes"]
        lessons = []

        for order, raw_lesson in enumerate(raw_section["lessons"], start=1):
            lesson_id = f"phak-{number:02d}-lesson-{order:02d}"
            lessons.append(
                {
                    "id": lesson_id,
                    "title": raw_lesson["title"],
                    "order": order,
                    "estimatedMinutes": 4,
                    "concept": raw_lesson["concept"],
                    "explanation": raw_lesson["explanation"],
                    "workedExample": raw_lesson["workedExample"],
                    "sourceCitation": citation(chapter, raw_lesson["page"]),
                    "acsCodes": acs_codes,
                    "practice": build_question(
                        f"{lesson_id}-practice",
                        chapter,
                        raw_lesson["page"],
                        acs_codes,
                        raw_lesson["practice"],
                    ),
                }
            )

        quiz = []
        for index, (page, spec) in enumerate(raw_section["quiz"], start=1):
            quiz.append(
                build_question(
                    f"phak-{number:02d}-quiz-{index:02d}",
                    chapter,
                    page,
                    acs_codes,
                    spec,
                )
            )

        image_page, prompt, options, correct_index, explanation = raw_section["imageQuiz"]
        quiz.append(
            {
                "id": f"phak-{number:02d}-quiz-{len(quiz) + 1:02d}",
                "type": "image",
                "prompt": prompt,
                "options": options,
                "correctIndex": correct_index,
                "image": {
                    "uri": f"assets/phak/{chapter['asset']}",
                    "alt": f"FAA PHAK {chapter['figure_caption']}, handbook page {image_page}",
                    "caption": chapter["figure_caption"],
                    "sourcePage": image_page,
                },
                "explanation": explanation,
                "sourceCitation": citation(chapter, image_page),
                "acsCodes": acs_codes,
            }
        )

        sections.append(
            {
                "id": section_id,
                "title": chapter["title"],
                "order": number,
                "summary": raw_section["summary"],
                "sourcePages": f"{chapter['page_start']} to {chapter['page_end']}",
                "acsCodes": acs_codes,
                "lessons": lessons,
                "quiz": quiz,
            }
        )

        for glossary_index, (term, definition, page) in enumerate(raw_section["glossary"], start=1):
            glossary.append(
                {
                    "id": f"phak-{number:02d}-term-{glossary_index:02d}",
                    "term": term,
                    "definition": definition,
                    "sectionId": section_id,
                    "sourceCitation": citation(chapter, page),
                    "acsCodes": acs_codes,
                }
            )

    # One question from every chapter, followed by matching, calculation/concept,
    # and figure questions. This gives broad coverage and every supported type.
    exam_source = [section["quiz"][0] for section in sections]
    exam_source += [section["quiz"][1] for section in sections[:5]]
    exam_source += [section["quiz"][2] for section in sections[:4]]
    exam_source += [sections[index]["quiz"][3] for index in (1, 7, 9, 14)]
    if len(exam_source) != 30:
        raise AssertionError(f"expected 30 exam questions, got {len(exam_source)}")
    exam = []
    for index, source_question in enumerate(exam_source, start=1):
        question = copy.deepcopy(source_question)
        question["id"] = f"phak-exam-{index:02d}"
        if question["type"] == "matching":
            for pair_index, pair in enumerate(question["pairs"], start=1):
                pair["id"] = f"phak-exam-{index:02d}-pair-{pair_index}"
        exam.append(question)

    return {
        "id": "phak",
        "title": "Pilot's Handbook of Aeronautical Knowledge",
        "shortTitle": "PHAK",
        "description": "A chapter-by-chapter private-pilot learning module based on FAA-H-8083-25C, with cited microlessons, active practice, section quizzes, and a cumulative exam.",
        "version": "2026.07.12",
        "source": {
            "title": SOURCE_TITLE,
            "url": SOURCE_URL,
            "edition": SOURCE_EDITION,
            "checksum": SOURCE_SHA256,
        },
        "sections": sections,
        "exam": exam,
        "glossary": glossary,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "src" / "content" / "phak.json")
    args = parser.parse_args()
    module = build_module()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(module, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    lesson_count = sum(len(section["lessons"]) for section in module["sections"])
    quiz_count = sum(len(section["quiz"]) for section in module["sections"])
    print(
        f"Wrote {args.output}: {len(module['sections'])} sections, "
        f"{lesson_count} lessons, {quiz_count} quiz questions, "
        f"{len(module['exam'])} exam questions, {len(module['glossary'])} terms"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

