# Preflight

Preflight is an iOS-first Expo/React Native microlearning app for the FAA Private Pilot written test. It ships four cited FAA modules: the _Pilot's Handbook of Aeronautical Knowledge_, _Airplane Flying Handbook_, _Aviation Weather Handbook_, and _Risk Management Handbook_. Each module has its own route and progress, while Practice combines only material from completed sections across the full curriculum.

## Run the app

Requirements: Node 22.13+, Xcode with an iOS 16.4+ simulator, and npm.

```sh
npm install
npm run ios
```

For browser-based UI checks:

```sh
npm run web -- --port 4173
```

The app uses Expo Router and ships its initial content and figures in the binary. On launch it can atomically activate the checksum-verified, versioned bundle hosted in Sanity, while retaining the bundled or last-known-good version if sync fails. Learning state stays on-device in Expo SQLite. No account, server, payment system, analytics vendor, or runtime AI API is used.

## Validate

```sh
npm run typecheck
npm test
npm run content:validate
npm run secrets:check
npx expo-doctor
```

The latest product-design comparison and verification notes are in [design-qa.md](./design-qa.md).

## Security

Two automated, blocking checks run on every pull request and every push to `main` ([.github/workflows/secret-scan.yml](./.github/workflows/secret-scan.yml)) so secrets never reach the client bundle or the git history:

- **[gitleaks](https://github.com/gitleaks/gitleaks)** scans the working tree and full commit history using its default ruleset plus this repo's custom rules in [.gitleaks.toml](./.gitleaks.toml).
- **An `EXPO_PUBLIC_` token guard** ([scripts/ci/check-expo-public-secrets.sh](./scripts/ci/check-expo-public-secrets.sh)) fails the build if a token-like value is assigned to any `EXPO_PUBLIC_*` variable. Expo inlines every `EXPO_PUBLIC_*` value into the client bundle at build time, so a secret placed there ships to every device and is readable straight from the IPA — the exact footgun called out under [Sanity Studio](#sanity-studio) above.

Run the checks locally:

```sh
npm run secrets:check                        # the EXPO_PUBLIC_ guard
npm run secrets:check -- --selftest          # prove the guard's rules still fire
gitleaks dir --config .gitleaks.toml .       # working tree
gitleaks git --config .gitleaks.toml .       # full history
```

`.env` is gitignored; only the `*.env.example` templates (with empty secret values) are tracked. Removing a leaked token in a later commit does **not** un-leak it — if a real `SANITY_AUTH_TOKEN` is ever committed, rotate it in Sanity immediately.

As a defense-in-depth complement to the CI gate, enable GitHub's native **secret scanning** and **push protection** for this repository under **Settings → Code security** (free for public repositories). Push protection blocks a recognized secret at `git push`, before it ever reaches the remote.

## Content pipeline

The reproducible handbook pipeline is documented in [scripts/content/README.md](./scripts/content/README.md). It pins all four official FAA sources, extracts handbook text and representative figures, builds `src/content/catalog.json`, and rejects invalid coverage, citations, ACS tags, answer keys, provenance, or image references.

A weekly [link check](./.github/workflows/link-check.yml) (via [lychee](https://github.com/lycheeverse/lychee)) validates the FAA source URLs configured in this pipeline alongside every Markdown link, so a rotted citation can't silently break traceability. It fails any pull request that touches docs and, on the scheduled run, opens a self-closing tracking issue instead of blocking unrelated work. Known-flaky and placeholder hosts are allowlisted in [lychee.toml](./lychee.toml).

Current bundle:

- 4 modules
- 89 sections
- 390 microlessons
- 356 section-quiz questions
- 120 module-exam questions
- 267 glossary terms
- 89 bundled FAA figures
- 866 unique questions across multiple choice, numeric, matching, and image formats

## Sanity Studio

The standalone Studio lives in `studio/` and targets project `4qoowg94`, dataset `production`.
Use Node 24.18+ for Studio schema deployment (`cd studio && nvm use`); the app itself supports Node 22.13+.
The hosted CMS is available at https://preflight-content.sanity.studio/.

```sh
npm run studio
npm run studio:deploy-schema
```

After authenticating the Sanity CLI, validate the complete catalog without mutations, then publish all four modules, assets, and the schema-v2 release:

```sh
cd studio
npm run schema:deploy
npm run seed:catalog:dry-run
npm run seed:catalog:cli
```

Alternatively, provide a server-side Editor token only to the seed process:

```sh
cd studio
SANITY_AUTH_TOKEN=... npm run seed:catalog -- --publish
```

Never expose that token through an `EXPO_PUBLIC_` variable or bundle it into the app. The idempotent import creates or replaces 1,745 published curriculum documents, uploads 89 figures, and uploads the checksum-verified catalog and manifest to Sanity's CDN. Omitting `--publish` writes review drafts instead.

Validate every live document and its references with:

```sh
cd studio
npx sanity documents validate --workspace preflight --yes --level warning
```

## EAS

`eas.json` contains development, preview, and production profiles. Configure the Expo/Apple account when ready, then run:

```sh
npx eas build --platform ios --profile preview
```

TestFlight submission and Apple signing are intentionally left for the account owner.
