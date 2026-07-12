#!/usr/bin/env python3
"""Download and checksum the official PHAK PDF."""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

from phak_config import SOURCE_FILE, SOURCE_SHA256, SOURCE_URL


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(target: Path, force: bool = False) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not force and sha256(target) == SOURCE_SHA256:
        print(f"PHAK already verified: {target}")
        return target

    partial = target.with_suffix(".pdf.partial")
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "PreflightContentBuilder/0.1"},
    )
    with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as out:
        while chunk := response.read(1024 * 1024):
            out.write(chunk)

    actual = sha256(partial)
    if actual != SOURCE_SHA256:
        partial.unlink(missing_ok=True)
        raise RuntimeError(
            f"Unexpected FAA PDF checksum: {actual}; expected {SOURCE_SHA256}. "
            "Review the new FAA edition before updating the pinned checksum."
        )
    if partial.read_bytes()[:5] != b"%PDF-":
        partial.unlink(missing_ok=True)
        raise RuntimeError("Downloaded file is not a PDF")
    partial.replace(target)
    print(f"Downloaded and verified {target} ({actual})")
    return target


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=Path, default=SOURCE_FILE)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        download(args.target, args.force)
    except Exception as error:
        print(f"download failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

