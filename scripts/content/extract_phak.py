#!/usr/bin/env python3
"""Extract chapter text/metadata and reproducible page crops from the PHAK."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import fitz
from PIL import Image

from phak_config import CHAPTERS, PROJECT_ROOT, SOURCE_FILE, SOURCE_SHA256


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def printed_label(text: str) -> str | None:
    for line in text.splitlines()[:12]:
        candidate = line.strip()
        if re.fullmatch(r"(?:\d{1,2}|[A-Z])-\d{1,3}", candidate):
            return candidate
    return None


def render_page(page: fitz.Page, output: Path) -> None:
    # Crop only printer margins; retain the page label and all figure captions.
    rect = page.rect + (22, 24, -22, -24)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.7, 1.7), clip=rect, alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "JPEG", quality=88, optimize=True, progressive=True)


def extract(pdf: Path, asset_dir: Path, text_dir: Path) -> dict:
    actual_hash = file_sha256(pdf)
    if actual_hash != SOURCE_SHA256:
        raise RuntimeError(f"source checksum mismatch: {actual_hash}")

    document = fitz.open(pdf)
    if document.page_count != 522:
        raise RuntimeError(f"expected 522 PDF pages, got {document.page_count}")

    manifest = {
        "sourceSha256": actual_hash,
        "pdfPageCount": document.page_count,
        "chapters": [],
    }
    text_dir.mkdir(parents=True, exist_ok=True)

    for chapter in CHAPTERS:
        pages = [document[index] for index in range(chapter["pdf_start"] - 1, chapter["pdf_end"])]
        first_label = printed_label(pages[0].get_text("text"))
        last_label = printed_label(pages[-1].get_text("text"))
        if first_label != chapter["page_start"] or last_label != chapter["page_end"]:
            raise RuntimeError(
                f"chapter {chapter['number']} labels changed: "
                f"{first_label}..{last_label}"
            )

        chapter_text = "\n\n".join(page.get_text("text") for page in pages)
        text_path = text_dir / f"chapter-{chapter['number']:02d}.txt"
        text_path.write_text(chapter_text, encoding="utf-8")

        figure_page = document[chapter["figure_pdf_page"] - 1]
        figure_text = figure_page.get_text("text")
        figure_label = printed_label(figure_text)
        if figure_label != chapter["figure_label"]:
            raise RuntimeError(
                f"figure page for chapter {chapter['number']} changed: {figure_label}"
            )
        output = asset_dir / chapter["asset"]
        render_page(figure_page, output)

        manifest["chapters"].append(
            {
                "number": chapter["number"],
                "title": chapter["title"],
                "pdfPages": [chapter["pdf_start"], chapter["pdf_end"]],
                "handbookPages": [chapter["page_start"], chapter["page_end"]],
                "textFile": str(text_path.relative_to(PROJECT_ROOT)),
                "textCharacters": len(chapter_text),
                "figure": {
                    "pdfPage": chapter["figure_pdf_page"],
                    "handbookPage": chapter["figure_label"],
                    "caption": chapter["figure_caption"],
                    "asset": str(output.relative_to(PROJECT_ROOT)),
                    "sha256": file_sha256(output),
                },
            }
        )

    manifest_path = text_dir.parent / "chapter-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(CHAPTERS)} chapters and {len(CHAPTERS)} page crops")
    print(f"Metadata: {manifest_path}")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=SOURCE_FILE)
    parser.add_argument("--assets", type=Path, default=PROJECT_ROOT / "assets" / "phak")
    parser.add_argument(
        "--text-dir", type=Path, default=PROJECT_ROOT / "tmp" / "pdfs" / "extracted"
    )
    args = parser.parse_args()
    extract(args.pdf, args.assets, args.text_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

