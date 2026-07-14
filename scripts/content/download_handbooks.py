#!/usr/bin/env python3
"""Download and checksum-pin every FAA handbook used by the curriculum."""

from __future__ import annotations

import hashlib
import subprocess
import urllib.request
from pathlib import Path

from catalog_seed import MODULE_SPECS


ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "tmp" / "pdfs"


def main() -> None:
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    for module_id, (source, _) in MODULE_SPECS.items():
        output = PDF_DIR / f"{module_id}.pdf"
        if not output.exists():
            print(f"Downloading {source.short_title}...")
            urllib.request.urlretrieve(source.url, output)
        digest = hashlib.sha256(output.read_bytes()).hexdigest()
        if digest != source.checksum:
            raise ValueError(f"{source.short_title} checksum mismatch: {digest}")
        info = subprocess.run(["pdfinfo", str(output)], check=True, capture_output=True, text=True).stdout
        pages = next(int(line.split(":", 1)[1]) for line in info.splitlines() if line.startswith("Pages:"))
        if pages != source.page_count:
            raise ValueError(f"{source.short_title} page count mismatch: expected {source.page_count}, got {pages}")
        subprocess.run(["pdftotext", "-layout", str(output), str(PDF_DIR / f"{module_id}.txt")], check=True)
        print(f"Verified {source.short_title}: {pages} pages, sha256 {digest}")


if __name__ == "__main__":
    main()
