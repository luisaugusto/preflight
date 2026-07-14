# FAA curriculum content pipeline

The schema-v2 catalog combines four checksum-pinned FAA handbooks. The legacy
`src/content/phak.json` remains available only for schema-v1 sync compatibility;
`src/content/catalog.json` is the canonical bundled curriculum.

## Authoritative sources

| Module | Edition               | FAA source                                                                                                                | SHA-256                                                            |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| PHAK   | FAA-H-8083-25C (2023) | https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak                                                  | `247929cace0ab56b376e683eba540cc4c8f39f199ab35414e8b604e24f395cb7` |
| AFH    | FAA-H-8083-3C (2021)  | https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/00_afh_full.pdf | `90dda95dcbe992bd798f1932b02b5a02d620d8344565c0516a6917f29dea1f8d` |
| AWH    | FAA-H-8083-28B (2026) | https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf                                                                | `2a87e4a5613e2a8e060aaf83a95dfc55b61b0e576f5b783df9fdcebe62da62c3` |
| RMH    | FAA-H-8083-2A (2022)  | https://www.faa.gov/sites/faa.gov/files/2022-06/risk_management_handbook_2A.pdf                                           | `519443a598eedd34c1824ad2ea482f393af0b80e52649e33c0e24a351e4c78bf` |

The direct PHAK PDF used by the build is
https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf.
The FAA PHAK landing page requested for later reference is
https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak.

## Rebuild

Poppler (`pdfinfo`, `pdftotext`, and `pdftoppm`) is required.

```sh
npm run content:download
npm run content:build
npm run content:validate
```

Downloads and extracted text stay under ignored `tmp/pdfs/`. The build verifies
the pinned checksums and page counts, generates the four-module catalog and TOC
coverage report, renders one cited offline figure per section, and emits Metro's
literal asset registry.

## Validation guarantees

- Ordered module totals: 89 sections, 390 lessons, 866 questions, 267 terms, and 89 figures.
- Two to six lessons and four mixed-format questions per section.
- Thirty unique cumulative exam questions per module, using all four interaction types.
- Globally unique stable IDs and explicit module/section provenance.
- Human printed-page labels plus one-based physical PDF page locators.
- Pinned FAA-S-ACS-6C vocabulary, valid answers, and existing offline assets.
- A coverage entry for every section, lesson, and handbook appendix disposition.
