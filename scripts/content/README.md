# PHAK content pipeline

This pipeline pins, extracts, builds, and validates the first Preflight module
from the official FAA _Pilot's Handbook of Aeronautical Knowledge_,
FAA-H-8083-25C.

## Rebuild

From the project root:

```sh
python3 -m venv tmp/pdfs/.venv
tmp/pdfs/.venv/bin/pip install -r scripts/content/requirements.txt
tmp/pdfs/.venv/bin/python scripts/content/download_phak.py
tmp/pdfs/.venv/bin/python scripts/content/extract_phak.py
python3 scripts/content/build_bundle.py
python3 scripts/content/validate_bundle.py
```

The downloader accepts the FAA source only when its SHA-256 matches the pinned
edition. A changed checksum is treated as a new source revision that requires
editorial review. Extraction verifies the 522-page document, all 17 printed
chapter ranges, and the printed label of every selected figure page before it
overwrites the app assets.

Intermediate text and source files live under `tmp/pdfs/`. The checked-in
outputs are `src/content/phak.json` and the 17 optimized page crops under
`assets/phak/`.

## Editorial guarantees

- 17 ordered PHAK chapters, each with three sub-five-minute lessons.
- Every lesson includes a concept, explanation, worked example, active practice,
  FAA chapter/page citation, and Private Pilot ACS tags.
- Every section quiz mixes at least three interaction types.
- The cumulative 30-question exam includes multiple-choice, numeric, matching,
  and image questions.
- Every assessed answer has an explanation and source citation.
- Stable IDs make regeneration idempotent for app progress and CMS imports.
