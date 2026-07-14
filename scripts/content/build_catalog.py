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
CONTENT_VERSION = "2026.07.14-questions.2"
GENERATED_AT = "2026-07-14T22:07:20.000Z"
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


def clean_extracted_sentence(value: str) -> str:
    sentence = re.sub(r"\s+", " ", value).strip(" •-")
    sentence = re.sub(r"^(?:(?:T|G|V|I),?\s+){2,}", "", sentence)
    if re.match(r"^(?:Chapter\s+\d+|\d+(?:\.\d+)+)\b", sentence, re.IGNORECASE):
        markers = list(
            re.finditer(
                r"\b(?:A|An|The|There|Since|Pilots?|Weather|Wind|Clouds?|Thunderstorms?)\s+[A-Za-z]",
                sentence,
            )
        )
        marker = next((item for item in markers if item.start() >= 12), None)
        if marker:
            sentence = sentence[marker.start() :]
    return sentence.strip()


def clean_question_statement(value: str) -> str:
    """Remove extraction-only headers and figure labels from learner-facing text."""
    statement = clean_extracted_sentence(value)
    statement = re.sub(r"\[Figure\s+[^\]]+\]\s*", "", statement, flags=re.IGNORECASE)
    statement = re.sub(
        r"^Chapter\s+\d+(?::|,)\s*.*?\bIntroduction\s+",
        "",
        statement,
        flags=re.IGNORECASE,
    )
    statement = re.sub(
        r"^Chapter\s+\d+(?:\s*[:,])?.*?\b\d+-\d+\s+",
        "",
        statement,
        flags=re.IGNORECASE,
    )
    tokens = re.findall(r"\b\w+\b", statement)
    single_character_tokens = sum(len(token) == 1 for token in tokens)
    if tokens and single_character_tokens / len(tokens) > 0.12:
        marker = re.search(r"\b(?:A|An|The|Pilots?|When)\s+[A-Za-z]{3,}\b", statement[25:])
        if marker:
            statement = statement[25 + marker.start() :]
    statement = re.sub(r"(?<=\d),\s+(?=\d{3}\b)", ",", statement)
    return re.sub(r"\s+", " ", statement).strip()


class PdfText:
    def __init__(self, module_id: str, source: SourceSpec):
        pdf_path = PDF_DIR / f"{module_id}.pdf"
        text_path = PDF_DIR / f"{module_id}-flow.txt"
        if not pdf_path.exists():
            raise FileNotFoundError(f"Missing pinned source {pdf_path}; run download_handbooks.py")
        digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
        if digest != source.checksum:
            raise ValueError(f"{module_id} checksum mismatch: {digest}")
        if not text_path.exists():
            subprocess.run(["pdftotext", str(pdf_path), str(text_path)], check=True)
        raw_pages = text_path.read_text(encoding="utf-8", errors="ignore").split("\f")
        self.pages = [clean_page(page) for page in raw_pages]
        if len(self.pages) not in {source.page_count, source.page_count + 1}:
            raise ValueError(
                f"{module_id} page count mismatch: expected {source.page_count}, extracted {len(self.pages)}"
            )

    def best_page(
        self,
        physical_start: int,
        physical_end: int,
        topic: str,
        preferred_physical: int | None = None,
    ) -> tuple[int, str]:
        words = normalized_words(topic)
        candidates = []
        for physical in range(physical_start, physical_end + 1):
            text = self.pages[physical - 1] if physical - 1 < len(self.pages) else ""
            lower = text.lower()
            presence = sum(1 for word in words if word in lower)
            frequency = sum(min(lower.count(word), 3) for word in words)
            distance = abs(physical - preferred_physical) if preferred_physical else 0
            score = presence * 8 + frequency - distance * 0.6
            if topic.lower() in lower:
                score += 20
            score -= min(lower.count("information contained in"), 3) * 5
            score -= min(lower.count("see section"), 3) * 5
            candidates.append((score, -distance, -physical, physical, text))
        _, _, _, physical, text = max(candidates)
        return physical, text


def excerpt_for(text: str, topic: str, excluded_concepts: set[str] | None = None) -> tuple[str, str]:
    words = normalized_words(topic)
    sentences = [
        cleaned
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if len(cleaned := clean_extracted_sentence(sentence)) >= 35
    ]
    if not sentences:
        concept = f"{topic} requires recognizing the relevant cues, limitations, and pilot actions."
        explanation = (
            "Use the handbook procedure as part of a complete risk picture, verify the current aircraft "
            "state, and preserve an escape option before margins narrow."
        )
        return concept, explanation

    def sentence_score(item: tuple[int, str]) -> tuple[int, int, int]:
        index, sentence = item
        nearby = " ".join(sentences[max(0, index - 1) : index + 2])
        direct_overlap = len(words & normalized_words(sentence))
        nearby_overlap = len(words & normalized_words(nearby))
        readable = 1 if 45 <= len(sentence) <= 280 else 0
        return direct_overlap + nearby_overlap, readable, -index

    excluded = {re.sub(r"\s+", " ", value).strip().lower() for value in (excluded_concepts or set())}
    eligible = [
        item
        for item in enumerate(sentences)
        if re.sub(r"\s+", " ", item[1]).strip().lower() not in excluded
    ]
    concept_index, concept = max(eligible or list(enumerate(sentences)), key=sentence_score)
    if len(concept) > 320:
        concept = concept[:317].rsplit(" ", 1)[0] + "..."
    context = [
        sentence
        for index, sentence in enumerate(sentences)
        if index != concept_index and abs(index - concept_index) <= 3
    ]
    explanation = " ".join(context[:3])[:850]
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


LESSON_LIST_STEMS = (
    "Which item does the cited handbook specifically include under {topic}?",
    "According to the cited page, which item is an aspect of {topic}?",
    "Which practice is explicitly listed in the handbook discussion of {topic}?",
    "A learner is briefing {topic}. Which source-listed item belongs in that briefing?",
    "From the FAA examples for {topic}, which item appears on the cited page?",
    "What specific {topic} practice is named in the handbook?",
    "Recall the cited list for {topic}. Which item is included?",
    "During a briefing on {topic}, which example comes directly from the source?",
)
QUIZ_LIST_STEMS = (
    "For the section check, which item is specifically listed under {topic}?",
    "Which cited example belongs to the handbook discussion of {topic}?",
    "Select the item the source explicitly includes as part of {topic}.",
    "Which practice should be recalled from the cited lesson on {topic}?",
)
EXAM_LIST_STEMS = (
    "On a cumulative review, which item does the handbook list under {topic}?",
    "Which source-listed practice belongs to {topic}?",
    "Select the specific example the cited page gives for {topic}.",
    "Which item is explicitly included in the handbook guidance on {topic}?",
)
LESSON_FACT_STEMS = (
    "Which statement accurately recalls the cited handbook content on {topic}?",
    "What does the cited FAA page specifically establish about {topic}?",
    "Which source-grounded fact about {topic} is correct?",
    "A learner is reviewing {topic}. Which statement matches the cited content?",
    "According to the FAA discussion of {topic}, what is accurate?",
    "During review of {topic}, which fact comes from the cited page?",
    "Recall the source content for {topic}. Which statement is supported?",
    "What source-specific guidance applies when studying {topic}?",
)
QUIZ_FACT_STEMS = (
    "For the section check, which cited fact about {topic} is correct?",
    "Which handbook statement accurately describes {topic}?",
    "Select the source-grounded fact from the lesson on {topic}.",
    "Which statement correctly recalls the cited content on {topic}?",
)
EXAM_FACT_STEMS = (
    "On a cumulative review, which handbook fact about {topic} is correct?",
    "Which source-grounded statement accurately describes {topic}?",
    "Select the cited FAA content that applies to {topic}.",
    "Which statement correctly represents the handbook discussion of {topic}?",
)
LESSON_CLOZE_STEMS = (
    "Complete the cited handbook statement about {topic}: \"{cloze}\"",
    "While reviewing {topic}, which source detail correctly fills the blank? \"{cloze}\"",
    "The cited page states, \"{cloze}\" Which detail completes the statement?",
    "A learner is recalling the handbook wording on {topic}: \"{cloze}\" What belongs in the blank?",
    "Restore the missing source detail about {topic}: \"{cloze}\"",
    "Recall the FAA wording for {topic}. Which phrase completes \"{cloze}\"?",
    "Fill the blank using the cited content on {topic}: \"{cloze}\"",
    "Choose the phrase omitted from this handbook statement: \"{cloze}\"",
)
QUIZ_CLOZE_STEMS = (
    "For the section check, complete this cited statement about {topic}: \"{cloze}\"",
    "Which handbook detail fills the blank in this lesson recall? \"{cloze}\"",
    "Select the source-grounded phrase that completes: \"{cloze}\"",
    "Which detail completes the cited guidance on {topic}? \"{cloze}\"",
)
EXAM_CLOZE_STEMS = (
    "Cumulative review: complete the cited statement about {topic}: \"{cloze}\"",
    "Which source detail belongs in the blank? \"{cloze}\"",
    "Select the handbook phrase that correctly completes: \"{cloze}\"",
    "Which detail restores the cited guidance on {topic}? \"{cloze}\"",
)


def stable_number(value: str) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:12], 16)


def source_statement(lesson: dict) -> str:
    all_candidates = [
        cleaned
        for sentence in re.split(
            r"(?<=[.!?])\s+", f"{lesson.get('concept', '')} {lesson.get('explanation', '')}"
        )
        if 35 <= len(cleaned := clean_question_statement(sentence)) <= 320
    ]
    candidates = [
        sentence
        for sentence in all_candidates
        if len(normalized_words(sentence)) >= 5
        and not re.search(r":\s*\d+\.?$", sentence)
        and not re.match(r"^(?:figure|table)\s+\d", sentence, re.IGNORECASE)
    ]
    if not candidates:
        candidates = all_candidates
    if not candidates:
        return str(lesson["concept"]).strip()
    topic_words = normalized_words(lesson["title"])
    return max(
        enumerate(candidates),
        key=lambda item: (
            len(topic_words & normalized_words(item[1])),
            1 if len(item[1]) <= 240 else 0,
            -item[0],
        ),
    )[1]


def source_list_items(statement: str) -> list[str]:
    """Extract concrete examples from an FAA list without turning its heading into the answer."""
    marker_matches = list(
        re.finditer(
            r"\b(?:including|include(?:s|d)?|such as|consist(?:s|ed)? of|following)\b\s*:?,?\s*",
            statement,
            re.IGNORECASE,
        )
    )
    if not marker_matches:
        return []
    # The last marker is normally the most specific list. For example, "include
    # collision avoidance procedures including proper scanning..." should test
    # a scanning or runway-incursion detail, not the broad heading.
    tail = statement[marker_matches[-1].end() :].strip().rstrip(".")
    raw_items = re.split(r"\s*[,;]\s*|\s+\band\b\s+|\s+\bor\b\s+", tail, flags=re.IGNORECASE)
    items = []
    for raw in raw_items:
        item = re.sub(r"^(?:but\s+)?(?:are\s+)?not\s+limited\s+to\s+", "", raw, flags=re.I)
        item = re.sub(r"^(?:the|a|an)\s+", "", item.strip(" :;,."), flags=re.I)
        words = normalized_words(item)
        if 2 <= len(words) <= 10 and 8 <= len(item) <= 100 and item not in items:
            items.append(item)
    return items if len(items) >= 2 else []


def source_cloze_phrase(statement: str, lesson_title: str, salt: str) -> tuple[str, str] | None:
    """Blank a concrete phrase so the learner must recall content, not identify a title."""
    title_words = normalized_words(lesson_title)
    candidates = []
    chunks = re.split(
        r"\s*[,;:]\s*|\s+\bas well as\b\s+|\s+\bwhile\b\s+|\s+\bwhich\b\s+",
        statement.rstrip("."),
        flags=re.IGNORECASE,
    )
    for index, raw in enumerate(chunks):
        phrase = re.sub(r"^(?:and|or|but)\s+", "", raw.strip(), flags=re.I)
        tokens = phrase.split()
        if len(tokens) > 14:
            phrase = " ".join(tokens[-min(8, max(4, len(tokens) // 2)) :])
            tokens = phrase.split()
        words = normalized_words(phrase)
        normalized_phrase = re.sub(r"[^a-z0-9]+", " ", phrase.lower()).strip()
        normalized_title = re.sub(r"[^a-z0-9]+", " ", lesson_title.lower()).strip()
        cloze = statement.replace(phrase, "___", 1)
        if (
            3 <= len(tokens) <= 14
            and len(words) >= 2
            and len(normalized_words(cloze)) >= 3
            and normalized_phrase != normalized_title
        ):
            candidates.append(
                (
                    len(words - title_words),
                    -len(words & title_words),
                    1 if 4 <= len(tokens) <= 10 else 0,
                    index,
                    stable_number(f"{salt}:{phrase}"),
                    phrase,
                )
            )

    if candidates:
        phrase = max(candidates)[-1]
    else:
        tokens = statement.rstrip(".").split()
        if len(tokens) < 8:
            return None
        phrase = " ".join(tokens[-min(8, max(4, len(tokens) // 2)) :])
    cloze = statement.replace(phrase, "___", 1)
    if len(normalized_words(cloze)) < 3:
        return None
    return phrase, cloze


def source_answer(lesson: dict, salt: str) -> tuple[str, str | None, bool]:
    statement = source_statement(lesson)
    items = source_list_items(statement)
    if items:
        title_words = normalized_words(lesson["title"])
        ranked = sorted(
            items,
            key=lambda item: (
                len(title_words & normalized_words(item)),
                stable_number(f"{salt}:{item}"),
            ),
        )
        return ranked[0], None, True
    cloze_fact = source_cloze_phrase(statement, lesson["title"], salt)
    if cloze_fact:
        answer, cloze = cloze_fact
        return answer, cloze, False
    return statement, None, False


def standalone_distractor(lesson: dict, salt: str) -> str:
    answer = source_answer(lesson, salt)[0]
    return re.sub(r"^(?:and|or|but|as\s+well\s+as)\s+", "", answer, flags=re.IGNORECASE)


def related_lessons(target: dict, section_lessons: list[dict], module_lessons: list[dict], count: int = 3) -> list[dict]:
    target_words = normalized_words(f"{target['title']} {source_statement(target)}")
    siblings = [lesson for lesson in section_lessons if lesson["id"] != target["id"]]
    outsiders = [lesson for lesson in module_lessons if lesson["id"] != target["id"] and lesson not in siblings]

    def ranked(candidates: list[dict]) -> list[dict]:
        return sorted(
            candidates,
            key=lambda lesson: (
                -len(target_words & normalized_words(f"{lesson['title']} {source_statement(lesson)}")),
                stable_number(f"{target['id']}:{lesson['id']}"),
            ),
        )

    # Two neighboring concepts keep the options plausible; one concept from elsewhere
    # prevents every lesson in a four-topic section from reusing the same option set.
    selected = ranked(siblings)[:2]
    selected.extend(ranked(outsiders)[: max(0, count - len(selected))])
    if len(selected) < count:
        selected.extend(ranked(siblings)[len(selected) : count])
    return selected[:count]


def ordered_options(question_id: str, correct: str, distractors: list[str]) -> tuple[list[str], int]:
    unique = []
    for option in distractors:
        if option != correct and option not in unique:
            unique.append(option)
    if len(unique) < 3:
        raise ValueError(f"{question_id}: fewer than three distinct source-based distractors")
    options = unique[:3]
    correct_index = stable_number(question_id) % 4
    options.insert(correct_index, correct)
    return options, correct_index


def source_multiple_choice(
    question_id: str,
    module_id: str,
    section_id: str,
    lesson: dict,
    section_lessons: list[dict],
    module_lessons: list[dict],
    context: str,
    force_mode: str | None = None,
    image_uri: str | None = None,
) -> dict:
    # force_mode remains in the call signature for stable catalog-building call
    # sites, but title-identification questions are intentionally no longer a mode.
    del force_mode
    related = related_lessons(lesson, section_lessons, module_lessons, count=12)
    statement = source_statement(lesson)
    correct, cloze, is_list = source_answer(lesson, question_id)
    if context == "lesson":
        list_stems, fact_stems, cloze_stems = LESSON_LIST_STEMS, LESSON_FACT_STEMS, LESSON_CLOZE_STEMS
    elif context == "quiz":
        list_stems, fact_stems, cloze_stems = QUIZ_LIST_STEMS, QUIZ_FACT_STEMS, QUIZ_CLOZE_STEMS
    else:
        list_stems, fact_stems, cloze_stems = EXAM_LIST_STEMS, EXAM_FACT_STEMS, EXAM_CLOZE_STEMS

    if is_list:
        stems = list_stems
        prompt = stems[stable_number(question_id + ":stem") % len(stems)].format(
            topic=lesson["title"].lower()
        )
    elif cloze is None:
        stems = fact_stems
        prompt = stems[stable_number(question_id + ":stem") % len(stems)].format(
            topic=lesson["title"].lower()
        )
    else:
        stems = cloze_stems
        prompt = stems[stable_number(question_id + ":stem") % len(stems)].format(
            topic=lesson["title"].lower(), cloze=cloze
        )
    target_words = normalized_words(statement)
    distractors = []
    for item in related:
        distractor = standalone_distractor(item, f"{question_id}:{item['id']}")
        distractor_words = normalized_words(distractor)
        if distractor_words and len(distractor_words & target_words) / len(distractor_words) >= 0.65:
            continue
        distractors.append(distractor)
    if image_uri:
        prompt = f"Use the cited handbook page image. {prompt}"

    options, correct_index = ordered_options(question_id, correct, distractors)
    question = {
        "id": question_id,
        "moduleId": module_id,
        "sectionId": section_id,
        "type": "image" if image_uri else "multipleChoice",
        "prompt": prompt,
        "options": options,
        "correctIndex": correct_index,
        "explanation": f"The cited page states: {statement}",
        "sourceCitation": lesson["sourceCitation"],
        "acsCodes": lesson["acsCodes"],
    }
    if image_uri:
        question["image"] = {
            "uri": image_uri,
            "alt": f"Cited handbook page for {lesson['title'].lower()}.",
            "caption": f"Source page supporting {lesson['title']}.",
            "sourcePage": lesson["sourceCitation"]["page"],
        }
    return question


def source_matching(
    question_id: str,
    module_id: str,
    section: dict,
    context: str,
) -> dict:
    lessons = section["lessons"]
    start = stable_number(question_id) % len(lessons)
    selected = [lessons[(start + index) % len(lessons)] for index in range(min(3, len(lessons)))]
    prompt = (
        f"Match each {section['title']} topic to the statement supported by its cited lesson."
        if context == "quiz"
        else (
            f"Cumulative review: match these {section['title']} topics - "
            f"{', '.join(lesson['title'] for lesson in selected)} - to their source statements."
        )
    )
    return {
        "id": question_id,
        "moduleId": module_id,
        "sectionId": section["id"],
        "type": "matching",
        "prompt": prompt,
        "pairs": [
            {
                "id": f"{question_id}-pair-{index + 1}",
                "left": lesson["title"],
                "right": source_statement(lesson),
            }
            for index, lesson in enumerate(selected)
        ],
        "explanation": "Each pairing uses the statement extracted from that topic's cited handbook passage.",
        "sourceCitation": selected[0]["sourceCitation"],
        "acsCodes": selected[0]["acsCodes"],
    }


NUMERIC_FACT_PATTERN = re.compile(
    r"(?<![A-Za-z0-9,.])(?P<value>\d{1,5}(?:,\d{3})*(?:\.\d+)?)\s*"
    r"(?P<unit>percent|feet|foot|ft|knots?|kt|mph|degrees?|hours?|minutes?|seconds?|"
    r"nautical miles?|statute miles?|rpm|psi|inches?|volts?|gallons?|CFR)\b",
    re.IGNORECASE,
)


def numeric_fact(lesson: dict) -> tuple[str, float | int, str, str] | None:
    sentences = [
        clean_question_statement(sentence)
        for sentence in re.split(
            r"(?<=[.!?])\s+", f"{lesson.get('concept', '')} {lesson.get('explanation', '')}"
        )
    ]
    candidates = []
    for sentence in sentences:
        tokens = re.findall(r"\b[A-Za-z0-9_.]+\b", sentence)
        numeric_tokens = sum(bool(re.fullmatch(r"[\d_.]+", token)) for token in tokens)
        word_tokens = sum(bool(re.fullmatch(r"[A-Za-z]{2,}", token)) for token in tokens)
        if (
            word_tokens < 5
            or numeric_tokens > 8
            or numeric_tokens > word_tokens
            or re.search(r"\b(?:NAV|COM\d?|XPDR|IDNT|WPT|DTK|TRK)\b", sentence)
        ):
            continue
        for match in NUMERIC_FACT_PATTERN.finditer(sentence):
            raw = match.group("value")
            value = float(raw.replace(",", ""))
            if value == 0 or raw.startswith("000"):
                continue
            if value.is_integer():
                value = int(value)
            unit = match.group("unit")
            score = (
                2 if unit.lower() != "cfr" else 0,
                len(normalized_words(lesson["title"]) & normalized_words(sentence)),
                -len(sentence),
            )
            candidates.append((score, sentence.strip(), value, unit, raw))
    if not candidates:
        return None
    _, sentence, value, unit, raw = max(candidates)
    cloze = sentence.replace(raw, "___", 1)
    return cloze, value, unit, sentence


def source_numeric(question_id: str, module_id: str, section: dict, lesson: dict) -> dict:
    fact = numeric_fact(lesson)
    if fact is None:
        raise ValueError(f"{question_id}: lesson has no source-grounded numeric fact")
    cloze, value, unit, sentence = fact
    return {
        "id": question_id,
        "moduleId": module_id,
        "sectionId": section["id"],
        "type": "numeric",
        "prompt": (
            f"Complete the cited handbook statement about {lesson['title'].lower()}: "
            f"\"{cloze}\" What value belongs in the blank?"
        ),
        "answer": {
            "value": value,
            "tolerance": 0,
            "unit": unit,
            "acceptedFormats": [str(value), f"{value} {unit}"],
        },
        "explanation": f"The cited source statement is: {sentence}",
        "sourceCitation": lesson["sourceCitation"],
        "acsCodes": lesson["acsCodes"],
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
    excluded_concepts: set[str] | None = None,
) -> dict:
    physical_start = source.chapter_starts[spec.chapter] + spec.start - 1
    physical_end = source.chapter_starts[spec.chapter] + spec.end - 1
    preferred_printed = spec.start + round(
        (index - 1) * (spec.end - spec.start) / max(1, len(spec.topics) - 1)
    )
    preferred_physical = source.chapter_starts[spec.chapter] + preferred_printed - 1
    physical, text = pdf.best_page(
        physical_start,
        physical_end,
        topic,
        preferred_physical,
    )
    source_citation = citation(source, spec, physical)
    concept, explanation = excerpt_for(text, topic, excluded_concepts)
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
    lessons = []
    used_concepts: set[str] = set()
    for index, topic in enumerate(spec.topics, 1):
        lesson = generated_lesson(
            module_id,
            source,
            spec,
            section_id,
            topic,
            index,
            pdf,
            excluded_concepts=used_concepts,
        )
        lessons.append(lesson)
        used_concepts.add(lesson["concept"])
    return {
        "id": section_id,
        "title": spec.title,
        "order": order,
        "summary": f"Apply {', '.join(topic.lower() for topic in spec.topics[:3])}, and the related limitations and risk controls.",
        "sourcePages": f"{spec.chapter}-{spec.start} to {spec.chapter}-{spec.end}",
        "acsCodes": list(spec.acs_codes),
        "lessons": lessons,
        "quiz": [],
    }


def build_source_quiz(module_id: str, section: dict, module_lessons: list[dict]) -> list[dict]:
    lessons = section["lessons"]
    key = section["id"].removeprefix(f"{module_id}-section-")
    first = lessons[0]
    middle = lessons[len(lessons) // 2]
    last = lessons[-1]
    return [
        source_multiple_choice(
            f"{module_id}-{key}-quiz-01",
            module_id,
            section["id"],
            first,
            lessons,
            module_lessons,
            "quiz",
            force_mode="statement",
        ),
        source_matching(f"{module_id}-{key}-quiz-02", module_id, section, "quiz"),
        source_multiple_choice(
            f"{module_id}-{key}-quiz-03",
            module_id,
            section["id"],
            middle,
            lessons,
            module_lessons,
            "quiz",
            force_mode="topic",
        ),
        source_multiple_choice(
            f"{module_id}-{key}-quiz-04",
            module_id,
            section["id"],
            last,
            lessons,
            module_lessons,
            "quiz",
            force_mode="statement",
            image_uri=f"assets/{module_id}/section-{key}.jpg",
        ),
    ]


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
    module_lessons = [lesson for section in sections for lesson in section["lessons"]]
    numeric_candidates = [
        (section, lesson)
        for section in sections
        for lesson in section["lessons"]
        if numeric_fact(lesson) is not None
    ]
    selected_numeric = []
    numeric_answer_keys = set()
    for ratio in (0.1, 0.5, 0.9):
        if not numeric_candidates:
            break
        target = round((len(numeric_candidates) - 1) * ratio)
        for candidate_index in sorted(
            range(len(numeric_candidates)), key=lambda index: (abs(index - target), index)
        ):
            section, lesson = numeric_candidates[candidate_index]
            fact = numeric_fact(lesson)
            if fact is None:
                continue
            _, value, unit, _ = fact
            answer_key = (value, unit.lower())
            if answer_key in numeric_answer_keys:
                continue
            selected_numeric.append((section, lesson))
            numeric_answer_keys.add(answer_key)
            break
    numeric_slots = {
        slot: selected_numeric[index]
        for index, slot in enumerate((2, 12, 22)[: len(selected_numeric)])
    }
    questions = []
    for index in range(30):
        section = sections[(index * len(sections)) // 30]
        lesson = section["lessons"][index % len(section["lessons"])]
        question_id = f"{module_id}-exam-{index + 1:02d}"
        if index in numeric_slots:
            numeric_section, numeric_lesson = numeric_slots[index]
            question = source_numeric(question_id, module_id, numeric_section, numeric_lesson)
        elif index % 4 == 1:
            question = source_matching(question_id, module_id, section, "exam")
        elif index % 4 == 3:
            section_image_question = next(
                question for question in section["quiz"] if question["type"] == "image"
            )
            image_uri, image_citation = section_image(section)
            image_lesson = next(
                (
                    candidate
                    for candidate in section["lessons"]
                    if candidate["sourceCitation"]["pdfPage"] == image_citation["pdfPage"]
                ),
                None,
            )
            if image_lesson:
                question = source_multiple_choice(
                    question_id,
                    module_id,
                    section["id"],
                    image_lesson,
                    section["lessons"],
                    module_lessons,
                    "exam",
                    force_mode="statement",
                    image_uri=image_uri,
                )
            else:
                # Some legacy PHAK figures cite a chapter page that is broader than
                # any individual lesson. Preserve the authored, page-specific image
                # check instead of attaching an unrelated lesson statement to it.
                question = copy.deepcopy(section_image_question)
                question["id"] = question_id
                question["prompt"] = (
                    f"Cumulative source-image review: {section_image_question['prompt']}"
                )
        else:
            question = source_multiple_choice(
                question_id,
                module_id,
                section["id"],
                lesson,
                section["lessons"],
                module_lessons,
                "exam",
            )
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
    generated_lesson_ids: set[str] = set()
    generated_question_ids: set[str] = set()

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
                "phak",
                source,
                spec,
                section_id,
                topic,
                len(lessons) + 1,
                pdf,
                stable_index,
                {item["concept"] for item in lessons},
            )
            reserved_lesson_ids.add(lesson["id"])
            reserved_question_ids.add(lesson["practice"]["id"])
            generated_lesson_ids.add(lesson["id"])
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
            generated_question_ids.add(question_id)
        if not has_image:
            lesson = lessons[-1]
            old_id = quiz[-1]["id"]
            quiz[-1] = question_image(old_id, "phak", section_id, lesson["title"], image_uri, lesson["sourceCitation"], lesson["acsCodes"])
            generated_question_ids.add(old_id)

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

    module_lessons = [lesson for section in sections for lesson in section["lessons"]]
    for section in sections:
        for lesson in section["lessons"]:
            if lesson["id"] in generated_lesson_ids:
                lesson["practice"] = source_multiple_choice(
                    lesson["practice"]["id"],
                    "phak",
                    section["id"],
                    lesson,
                    section["lessons"],
                    module_lessons,
                    "lesson",
                )
        for index, question in enumerate(section["quiz"]):
            if question["id"] not in generated_question_ids:
                continue
            lesson = section["lessons"][index % len(section["lessons"])]
            if question["type"] == "matching":
                section["quiz"][index] = source_matching(question["id"], "phak", section, "quiz")
            else:
                section["quiz"][index] = source_multiple_choice(
                    question["id"],
                    "phak",
                    section["id"],
                    lesson,
                    section["lessons"],
                    module_lessons,
                    "quiz",
                    image_uri=(
                        f"assets/phak/section-{section['id'].removeprefix('phak-section-')}.jpg"
                        if question["type"] == "image"
                        else None
                    ),
                )

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
    module_lessons = [lesson for section in sections for lesson in section["lessons"]]
    for section in sections:
        for lesson in section["lessons"]:
            lesson["practice"] = source_multiple_choice(
                lesson["practice"]["id"],
                module_id,
                section["id"],
                lesson,
                section["lessons"],
                module_lessons,
                "lesson",
            )
        section["quiz"] = build_source_quiz(module_id, section, module_lessons)
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
