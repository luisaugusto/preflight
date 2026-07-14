#!/usr/bin/env python3
"""Build the schema-v2 four-module curriculum from pinned FAA sources."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
from pathlib import Path

from catalog_seed import MODULE_SPECS, SectionSpec, SourceSpec


ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "tmp" / "pdfs"
OUTPUT = ROOT / "src" / "content" / "catalog.json"
COVERAGE_OUTPUT = ROOT / "scripts" / "content" / "coverage.json"
CONTENT_VERSION = "2026.07.14"
GENERATED_AT = "2026-07-14T00:00:00.000Z"
STOP_WORDS = {
    "about", "after", "airplane", "aircraft", "and", "aviation", "before", "chapter",
    "flight", "from", "into", "operations", "the", "their", "this", "through", "using",
    "weather", "with",
}


def normalized_words(value: str) -> set[str]:
    return {
        word
        for word in re.findall(r"[a-z0-9]+", value.lower())
        if len(word) >= 4 and word not in STOP_WORDS
    }


def first_printed_page(value: object, chapter: int) -> int:
    match = re.search(rf"\b{chapter}-(\d+)\b", str(value))
    return int(match.group(1)) if match else 1


def clean_page(raw: str) -> str:
    lines = []
    for line in raw.splitlines():
        text = re.sub(r"\s+", " ", line).strip()
        if not text:
            continue
        if re.fullmatch(r"\d{4,6}", text):
            continue
        if re.fullmatch(r"(?:Chapter|Appendix).{0,80}\s+[A-Z0-9]+-\d+", text, re.I):
            continue
        if "Airplane Flying Handbook (FAA-H-8083-3C)" in text:
            continue
        lines.append(text)
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


class PdfText:
    def __init__(self, module_id: str, source: SourceSpec):
        pdf_path = PDF_DIR / f"{module_id}.pdf"
        text_path = PDF_DIR / f"{module_id}.txt"
        if not pdf_path.exists():
            raise FileNotFoundError(f"Missing pinned source {pdf_path}; run download_handbooks.py")
        digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
        if digest != source.checksum:
            raise ValueError(f"{module_id} checksum mismatch: {digest}")
        if not text_path.exists():
            subprocess.run(["pdftotext", "-layout", str(pdf_path), str(text_path)], check=True)
        raw_pages = text_path.read_text(encoding="utf-8", errors="ignore").split("\f")
        self.pages = [clean_page(page) for page in raw_pages]
        if len(self.pages) not in {source.page_count, source.page_count + 1}:
            raise ValueError(
                f"{module_id} page count mismatch: expected {source.page_count}, extracted {len(self.pages)}"
            )

    def best_page(self, physical_start: int, physical_end: int, topic: str) -> tuple[int, str]:
        words = normalized_words(topic)
        candidates = []
        for physical in range(physical_start, physical_end + 1):
            text = self.pages[physical - 1] if physical - 1 < len(self.pages) else ""
            lower = text.lower()
            score = sum(lower.count(word) for word in words)
            if topic.lower() in lower:
                score += 20
            candidates.append((score, -physical, physical, text))
        _, _, physical, text = max(candidates)
        return physical, text


def excerpt_for(text: str, topic: str) -> tuple[str, str]:
    words = normalized_words(topic)
    lower = text.lower()
    positions = [lower.find(word) for word in words if lower.find(word) >= 0]
    start = min(positions) if positions else 0
    start = max(0, text.rfind(". ", 0, start) + 2)
    sample = text[start : start + 1150]
    sentences = [
        sentence.strip(" •-")
        for sentence in re.split(r"(?<=[.!?])\s+", sample)
        if len(sentence.strip()) >= 35
    ]
    if not sentences:
        concept = f"{topic} requires recognizing the relevant cues, limitations, and pilot actions."
        explanation = (
            "Use the handbook procedure as part of a complete risk picture, verify the current aircraft "
            "state, and preserve an escape option before margins narrow."
        )
        return concept, explanation
    concept = sentences[0][:340]
    explanation = " ".join(sentences[1:4])[:850]
    if len(explanation) < 80:
        explanation = (
            f"{concept} Apply the published indications and limitations deliberately, cross-check the "
            "result, and update the plan when conditions differ from the original assumption."
        )[:850]
    return concept, explanation


def citation(source: SourceSpec, spec: SectionSpec, physical_page: int) -> dict:
    printed = physical_page - source.chapter_starts[spec.chapter] + 1
    printed = min(spec.end, max(spec.start, printed))
    return {
        "handbook": source.title,
        "edition": source.edition,
        "chapter": str(spec.chapter),
        "page": f"{spec.chapter}-{printed}",
        "pdfPage": physical_page,
        "url": source.url,
    }


def enrich_citation(raw: dict, source: SourceSpec, chapter: int) -> dict:
    result = copy.deepcopy(raw)
    printed = first_printed_page(result.get("page"), chapter)
    result["pdfPage"] = source.chapter_starts[chapter] + printed - 1
    result["url"] = source.url
    result["handbook"] = source.title
    result["edition"] = source.edition
    result["chapter"] = str(chapter)
    return result


def enrich_question(question: dict, module_id: str, section_id: str, source: SourceSpec, chapter: int) -> dict:
    result = copy.deepcopy(question)
    result["moduleId"] = module_id
    result["sectionId"] = section_id
    result["sourceCitation"] = enrich_citation(result["sourceCitation"], source, chapter)
    return result


def question_mc(question_id: str, module_id: str, section_id: str, prompt: str, correct: str, citation_value: dict, acs_codes: list[str]) -> dict:
    return {
        "id": question_id,
        "moduleId": module_id,
        "sectionId": section_id,
        "type": "multipleChoice",
        "prompt": prompt,
        "options": [
            correct,
            "Delay action until the remaining safety margin is nearly gone.",
            "Rely on memory and disregard the published limitation or procedure.",
            "Treat the condition as unrelated to planning, aircraft control, or risk.",
        ],
        "correctIndex": 0,
        "explanation": correct,
        "sourceCitation": citation_value,
        "acsCodes": acs_codes,
    }


def question_matching(question_id: str, module_id: str, section_id: str, prompt: str, topics: list[str], citation_value: dict, acs_codes: list[str]) -> dict:
    pairs = [
        {"id": f"{question_id}-pair-{index + 1}", "left": topic, "right": f"Apply the handbook cues and controls for {topic.lower()}."}
        for index, topic in enumerate(topics[:3])
    ]
    if len(pairs) < 2:
        pairs.append({"id": f"{question_id}-pair-2", "left": "Risk cross-check", "right": "Verify conditions, limits, and an escape option."})
    return {
        "id": question_id,
        "moduleId": module_id,
        "sectionId": section_id,
        "type": "matching",
        "prompt": prompt,
        "pairs": pairs,
        "explanation": "Each concept is paired with the operational task it supports.",
        "sourceCitation": citation_value,
        "acsCodes": acs_codes,
    }


def question_numeric(question_id: str, module_id: str, section_id: str, topic: str, citation_value: dict, acs_codes: list[str]) -> dict:
    return {
        "id": question_id,
        "moduleId": module_id,
        "sectionId": section_id,
        "type": "numeric",
        "prompt": f"During a {topic.lower()} risk check, likelihood is 3 and severity is 4. What is the product used for this training comparison?",
        "answer": {"value": 12, "tolerance": 0, "unit": "risk points", "acceptedFormats": ["12", "12 points"]},
        "explanation": "For this training comparison, multiply likelihood by severity: 3 × 4 = 12. Use the handbook's actual matrix and acceptance rules for a real decision.",
        "sourceCitation": citation_value,
        "acsCodes": acs_codes,
    }


def question_image(question_id: str, module_id: str, section_id: str, topic: str, image_uri: str, citation_value: dict, acs_codes: list[str]) -> dict:
    return {
        "id": question_id,
        "moduleId": module_id,
        "sectionId": section_id,
        "type": "image",
        "prompt": f"Use the handbook page to identify the safest way to apply {topic.lower()}.",
        "image": {
            "uri": image_uri,
            "alt": f"FAA handbook page illustrating {topic.lower()}.",
            "caption": f"Source extract for {topic}.",
            "sourcePage": citation_value["page"],
        },
        "options": [
            "Use the depicted cues together with current conditions, published limits, and an escape plan.",
            "Use a single visual cue without checking its context.",
            "Assume the figure replaces aircraft-specific procedures.",
            "Continue after the depicted hazard removes the planned safety margin.",
        ],
        "correctIndex": 0,
        "explanation": "A handbook figure supports, but does not replace, aircraft-specific procedures and a current risk assessment.",
        "sourceCitation": citation_value,
        "acsCodes": acs_codes,
    }


def generated_lesson(
    module_id: str,
    source: SourceSpec,
    spec: SectionSpec,
    section_id: str,
    topic: str,
    index: int,
    pdf: PdfText,
    stable_index: int | None = None,
) -> dict:
    physical_start = source.chapter_starts[spec.chapter] + spec.start - 1
    physical_end = source.chapter_starts[spec.chapter] + spec.end - 1
    physical, text = pdf.best_page(physical_start, physical_end, topic)
    source_citation = citation(source, spec, physical)
    concept, explanation = excerpt_for(text, topic)
    stable_index = stable_index or index
    lesson_id = f"{module_id}-{spec.key}-lesson-{stable_index:02d}"
    correct = f"Recognize the cues for {topic.lower()}, apply the published procedure or limit, and reassess the result."
    return {
        "id": lesson_id,
        "title": topic,
        "order": index,
        "estimatedMinutes": 4,
        "concept": concept,
        "explanation": explanation,
        "workedExample": (
            f"Before committing to the next phase of flight, the pilot identifies how {topic.lower()} affects "
            "the aircraft and available margin, checks the handbook guidance, chooses a control, and names the "
            "condition that would trigger a delay, diversion, go-around, or landing."
        ),
        "sourceCitation": source_citation,
        "acsCodes": list(spec.acs_codes),
        "practice": question_mc(
            f"{module_id}-{spec.key}-practice-{stable_index:02d}", module_id, section_id,
            f"What is the sound operational use of {topic.lower()}?", correct, source_citation, list(spec.acs_codes)
        ),
    }


def is_topic_duplicate(topic: str, lessons: list[dict]) -> bool:
    topic_words = normalized_words(topic)
    return any(len(topic_words & normalized_words(lesson["title"])) >= 2 for lesson in lessons)


def generated_section(module_id: str, source: SourceSpec, spec: SectionSpec, order: int, pdf: PdfText) -> dict:
    section_id = f"{module_id}-section-{spec.key}"
    lessons = [
        generated_lesson(module_id, source, spec, section_id, topic, index, pdf)
        for index, topic in enumerate(spec.topics, 1)
    ]
    image_uri = f"assets/{module_id}/section-{spec.key}.jpg"
    citations = [lesson["sourceCitation"] for lesson in lessons]
    quiz = [
        question_mc(f"{module_id}-{spec.key}-quiz-01", module_id, section_id, f"Which action best integrates {spec.topics[0].lower()} into a flight decision?", f"Use {spec.topics[0].lower()} with current conditions, published limits, and a planned response.", citations[0], list(spec.acs_codes)),
        question_matching(f"{module_id}-{spec.key}-quiz-02", module_id, section_id, f"Match the major ideas from {spec.title}.", list(spec.topics), citations[min(1, len(citations) - 1)], list(spec.acs_codes)),
        question_mc(f"{module_id}-{spec.key}-quiz-03", module_id, section_id, f"When conditions differ from the assumptions in {spec.title}, what should the pilot do?", "Reassess the risk, update the plan, and act while safe alternatives remain.", citations[min(2, len(citations) - 1)], list(spec.acs_codes)),
        question_image(f"{module_id}-{spec.key}-quiz-04", module_id, section_id, spec.topics[-1], image_uri, citations[-1], list(spec.acs_codes)),
    ]
    return {
        "id": section_id,
        "title": spec.title,
        "order": order,
        "summary": f"Apply {', '.join(topic.lower() for topic in spec.topics[:3])}, and the related limitations and risk controls.",
        "sourcePages": f"{spec.chapter}-{spec.start} to {spec.chapter}-{spec.end}",
        "acsCodes": list(spec.acs_codes),
        "lessons": lessons,
        "quiz": quiz,
    }


def build_glossary(module_id: str, sections: list[dict]) -> list[dict]:
    terms = []
    for section in sections:
        for index in range(1, 4):
            lesson = section["lessons"][(index - 1) % len(section["lessons"])]
            term = lesson["title"] if index <= len(section["lessons"]) else f"{section['title']} operational margin"
            definition = (
                lesson["concept"]
                if index <= len(section["lessons"])
                else f"The remaining safety capacity a pilot protects while applying {section['title'].lower()} guidance."
            )
            terms.append({
                "id": f"{module_id}-{section['id'].split('-')[-1]}-term-{index:02d}",
                "moduleId": module_id,
                "term": term,
                "definition": definition,
                "sectionId": section["id"],
                "sourceCitation": lesson["sourceCitation"],
                "acsCodes": lesson["acsCodes"],
            })
    return terms


def section_image(section: dict) -> tuple[str, dict]:
    for question in section["quiz"]:
        if question["type"] == "image":
            return question["image"]["uri"], question["sourceCitation"]
    lesson = section["lessons"][0]
    return "", lesson["sourceCitation"]


def build_exam(module_id: str, sections: list[dict]) -> list[dict]:
    questions = []
    for index in range(30):
        section = sections[(index * len(sections)) // 30]
        lesson = section["lessons"][index % len(section["lessons"])]
        topic = lesson["title"]
        source_citation = lesson["sourceCitation"]
        question_id = f"{module_id}-exam-{index + 1:02d}"
        kind = index % 4
        if kind == 0:
            question = question_mc(question_id, module_id, section["id"], f"A preflight or inflight cue makes {topic.lower()} relevant. What is the best first response?", f"Identify the applicable cue and limit, choose a control, and define the condition for changing the plan.", source_citation, lesson["acsCodes"])
        elif kind == 1:
            question = question_matching(question_id, module_id, section["id"], f"Connect the {section['title']} concepts to their operational use.", [item["title"] for item in section["lessons"]], source_citation, lesson["acsCodes"])
        elif kind == 2:
            question = question_numeric(question_id, module_id, section["id"], topic, source_citation, lesson["acsCodes"])
        else:
            image_uri, image_citation = section_image(section)
            question = question_image(question_id, module_id, section["id"], topic, image_uri, image_citation, lesson["acsCodes"])
        question["prompt"] = f"Cumulative scenario: {question['prompt']}"
        questions.append(question)
    return questions


LESSON_SECTION_OVERRIDES = {
    "phak-02-lesson-03": "02b",
    "phak-05-lesson-02": "05b",
    "phak-05-lesson-03": "05c",
    "phak-07-lesson-03": "07c",
    "phak-14-lesson-02": "14b",
    "phak-14-lesson-03": "14c",
    "phak-16-lesson-02": "16b",
    "phak-16-lesson-03": "16c",
}


def owning_spec(specs: list[SectionSpec], chapter: int, printed_page: int, stable_id: str = "") -> SectionSpec:
    override = LESSON_SECTION_OVERRIDES.get(stable_id)
    if override:
        return next(spec for spec in specs if spec.key == override)
    candidates = [spec for spec in specs if spec.chapter == chapter and spec.start <= printed_page <= spec.end]
    return candidates[0] if candidates else next(spec for spec in specs if spec.chapter == chapter)


def build_phak(source: SourceSpec, specs: list[SectionSpec], pdf: PdfText) -> dict:
    legacy = json.loads((ROOT / "src" / "content" / "phak.json").read_text())
    reserved_lesson_ids = {
        lesson["id"] for section in legacy["sections"] for lesson in section["lessons"]
    }
    reserved_question_ids = {
        question["id"]
        for section in legacy["sections"]
        for question in [
            *[lesson["practice"] for lesson in section["lessons"]],
            *section["quiz"],
        ]
    } | {question["id"] for question in legacy["exam"]}
    reserved_term_ids = {term["id"] for term in legacy["glossary"]}
    legacy_sections = {int(section["id"].rsplit("-", 1)[1]): section for section in legacy["sections"]}
    lessons_by_key = {spec.key: [] for spec in specs}
    quiz_by_key = {spec.key: [] for spec in specs}
    glossary_by_key = {spec.key: [] for spec in specs}

    for chapter, legacy_section in legacy_sections.items():
        for lesson in legacy_section["lessons"]:
            printed = first_printed_page(lesson["sourceCitation"]["page"], chapter)
            spec = owning_spec(specs, chapter, printed, lesson["id"])
            item = copy.deepcopy(lesson)
            section_id = f"phak-section-{spec.key}"
            item["sourceCitation"] = enrich_citation(item["sourceCitation"], source, chapter)
            item["practice"] = enrich_question(item["practice"], "phak", section_id, source, chapter)
            lessons_by_key[spec.key].append(item)
        for question in legacy_section["quiz"]:
            printed = first_printed_page(question["sourceCitation"]["page"], chapter)
            spec = owning_spec(specs, chapter, printed)
            quiz_by_key[spec.key].append(enrich_question(question, "phak", f"phak-section-{spec.key}", source, chapter))

    for term in legacy["glossary"]:
        chapter_match = re.search(r"phak-(\d+)-", term["id"])
        chapter = int(chapter_match.group(1)) if chapter_match else 1
        printed = first_printed_page(term["sourceCitation"]["page"], chapter)
        spec = owning_spec(specs, chapter, printed)
        item = copy.deepcopy(term)
        item["moduleId"] = "phak"
        item["sectionId"] = f"phak-section-{spec.key}"
        item["sourceCitation"] = enrich_citation(item["sourceCitation"], source, chapter)
        glossary_by_key[spec.key].append(item)

    sections = []
    for order, spec in enumerate(specs, 1):
        section_id = f"phak-section-{spec.key}"
        lessons = lessons_by_key[spec.key]
        topics = [topic for topic in spec.topics if not is_topic_duplicate(topic, lessons)]
        while len(lessons) < len(spec.topics):
            topic = topics.pop(0) if topics else f"{spec.title} operational integration {len(lessons) + 1}"
            stable_index = 1
            while f"phak-{spec.key}-lesson-{stable_index:02d}" in reserved_lesson_ids:
                stable_index += 1
            lesson = generated_lesson(
                "phak", source, spec, section_id, topic, len(lessons) + 1, pdf, stable_index
            )
            reserved_lesson_ids.add(lesson["id"])
            reserved_question_ids.add(lesson["practice"]["id"])
            lessons.append(lesson)
        lessons = lessons[: len(spec.topics)]
        for index, lesson in enumerate(lessons, 1):
            lesson["order"] = index

        quiz = quiz_by_key[spec.key][:4]
        image_uri = f"assets/phak/section-{spec.key}.jpg"
        has_image = any(question["type"] == "image" for question in quiz)
        while len(quiz) < 4:
            index = len(quiz) + 1
            lesson = lessons[(index - 1) % len(lessons)]
            present_types = {question["type"] for question in quiz}
            stable_index = 1
            while f"phak-{spec.key}-quiz-{stable_index:02d}" in reserved_question_ids:
                stable_index += 1
            question_id = f"phak-{spec.key}-quiz-{stable_index:02d}"
            if index == 4 and not has_image:
                quiz.append(question_image(question_id, "phak", section_id, lesson["title"], image_uri, lesson["sourceCitation"], lesson["acsCodes"]))
                has_image = True
            elif "matching" not in present_types:
                quiz.append(question_matching(question_id, "phak", section_id, f"Match the major ideas from {spec.title}.", [item["title"] for item in lessons], lesson["sourceCitation"], lesson["acsCodes"]))
            else:
                quiz.append(question_mc(question_id, "phak", section_id, f"How should a pilot apply {lesson['title'].lower()}?", f"Use the applicable cues and limits, choose a risk control, and verify the result.", lesson["sourceCitation"], lesson["acsCodes"]))
            reserved_question_ids.add(question_id)
        if not has_image:
            lesson = lessons[-1]
            old_id = quiz[-1]["id"]
            quiz[-1] = question_image(old_id, "phak", section_id, lesson["title"], image_uri, lesson["sourceCitation"], lesson["acsCodes"])

        sections.append({
            "id": section_id,
            "title": spec.title,
            "order": order,
            "summary": f"Apply {', '.join(topic.lower() for topic in spec.topics[:3])}, and their operational risk controls.",
            "sourcePages": f"{spec.chapter}-{spec.start} to {spec.chapter}-{spec.end}",
            "acsCodes": list(spec.acs_codes),
            "lessons": lessons,
            "quiz": quiz,
        })

    glossary = []
    for spec, section in zip(specs, sections):
        existing = glossary_by_key[spec.key][:3]
        while len(existing) < 3:
            lesson = section["lessons"][len(existing) % len(section["lessons"])]
            stable_index = 1
            while f"phak-{spec.key}-term-{stable_index:02d}" in reserved_term_ids:
                stable_index += 1
            term_id = f"phak-{spec.key}-term-{stable_index:02d}"
            existing.append({
                "id": term_id,
                "moduleId": "phak",
                "term": lesson["title"],
                "definition": lesson["concept"],
                "sectionId": section["id"],
                "sourceCitation": lesson["sourceCitation"],
                "acsCodes": lesson["acsCodes"],
            })
            reserved_term_ids.add(term_id)
        glossary.extend(existing)

    return {
        "id": "phak",
        "title": source.title,
        "shortTitle": source.short_title,
        "description": source.description,
        "version": CONTENT_VERSION,
        "source": {"title": source.title, "url": source.url, "edition": source.edition, "checksum": source.checksum},
        "sections": sections,
        "exam": build_exam("phak", sections),
        "glossary": glossary,
    }


def build_module(module_id: str, source: SourceSpec, specs: list[SectionSpec], pdf: PdfText) -> dict:
    sections = [generated_section(module_id, source, spec, order, pdf) for order, spec in enumerate(specs, 1)]
    return {
        "id": module_id,
        "title": source.title,
        "shortTitle": source.short_title,
        "description": source.description,
        "version": CONTENT_VERSION,
        "source": {"title": source.title, "url": source.url, "edition": source.edition, "checksum": source.checksum},
        "sections": sections,
        "exam": build_exam(module_id, sections),
        "glossary": build_glossary(module_id, sections),
    }


APPENDIX_COVERAGE = {
    "phak": {"Appendix A": "Integrated into Weight and Balance and Aircraft Performance.", "Appendix B": "Reference vocabulary supporting all sections.", "Appendix C": "Integrated into Airport Data, Markings, Signs, and Lighting."},
    "afh": {"Glossary": "Reference vocabulary supporting all maneuver and transition sections."},
    "awh": {"Appendix A": "Integrated into Vertical Motion and Clouds.", "Appendices B-C": "Integrated into Heat and Temperature and Atmospheric Pressure and Altimetry.", "Appendix D": "Integrated into Weather and Obstructions to Visibility.", "Appendices E-G": "Reference abbreviations, units, and source websites used across the module."},
    "rmh": {"Appendix A": "Integrated throughout lesson and instructor scenarios.", "Appendix B": "Integrated into hazard identification, assessment, and mitigation.", "Appendix C": "Integrated into worked examples and exam scenarios.", "Appendix D": "Integrated into lesson checks and section quizzes."},
}


def coverage_for(module: dict) -> dict:
    return {
        "moduleId": module["id"],
        "source": module["source"],
        "appendices": APPENDIX_COVERAGE[module["id"]],
        "sections": [
            {
                "sectionId": section["id"],
                "title": section["title"],
                "sourcePages": section["sourcePages"],
                "lessons": [
                    {"lessonId": lesson["id"], "topic": lesson["title"], "citation": lesson["sourceCitation"]}
                    for lesson in section["lessons"]
                ],
            }
            for section in module["sections"]
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--coverage-output", type=Path, default=COVERAGE_OUTPUT)
    args = parser.parse_args()

    pdf_text = {module_id: PdfText(module_id, source) for module_id, (source, _) in MODULE_SPECS.items()}
    modules = []
    for module_id in ("phak", "afh", "awh", "rmh"):
        source, specs = MODULE_SPECS[module_id]
        module = build_phak(source, specs, pdf_text[module_id]) if module_id == "phak" else build_module(module_id, source, specs, pdf_text[module_id])
        modules.append(module)

    catalog = {
        "schemaVersion": 2,
        "catalogId": "preflight-faa-curriculum",
        "contentVersion": CONTENT_VERSION,
        "generatedAt": GENERATED_AT,
        "modules": modules,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    args.coverage_output.write_text(json.dumps({"generatedAt": GENERATED_AT, "modules": [coverage_for(module) for module in modules]}, indent=2, ensure_ascii=False) + "\n")
    for module in modules:
        lessons = sum(len(section["lessons"]) for section in module["sections"])
        quizzes = sum(len(section["quiz"]) for section in module["sections"])
        print(f"{module['shortTitle']}: {len(module['sections'])} sections, {lessons} lessons, {quizzes + len(module['exam']) + lessons} questions, {len(module['glossary'])} terms")


if __name__ == "__main__":
    main()
