#!/usr/bin/env python3
"""Render one cited FAA source page for every catalog section figure."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "src" / "content" / "catalog.json"
PDF_DIR = ROOT / "tmp" / "pdfs"


def main() -> None:
    catalog = json.loads(CATALOG.read_text())
    rendered = 0
    for module in catalog["modules"]:
        for section in module["sections"]:
            image_question = next(question for question in section["quiz"] if question["type"] == "image")
            uri = image_question["image"]["uri"]
            output = ROOT / uri
            if output.exists():
                continue
            pdf_page = image_question["sourceCitation"].get("pdfPage")
            if not isinstance(pdf_page, int) or pdf_page < 1:
                raise ValueError(f"{image_question['id']} has no valid physical PDF page")
            output.parent.mkdir(parents=True, exist_ok=True)
            prefix = output.with_suffix("")
            subprocess.run(
                [
                    "pdftoppm", "-f", str(pdf_page), "-l", str(pdf_page), "-singlefile",
                    "-jpeg", "-jpegopt", "quality=82,progressive=y", "-scale-to", "1400",
                    str(PDF_DIR / f"{module['id']}.pdf"), str(prefix),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
            )
            rendered += 1
    print(f"Rendered {rendered} new section figures.")


if __name__ == "__main__":
    main()
