# Preflight

Preflight is an iOS-first Expo/React Native microlearning app for the FAA Private Pilot written test. This MVP ships the complete _Pilot's Handbook of Aeronautical Knowledge_ (FAA-H-8083-25C) as 17 cited sections with active lessons, four question types, section quizzes, a module exam, spaced repetition, vocabulary, and calculation practice.

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
npx expo-doctor
```

The latest product-design comparison and verification notes are in [design-qa.md](./design-qa.md).

## Content pipeline

The reproducible handbook pipeline is documented in [scripts/content/README.md](./scripts/content/README.md). It pins the official FAA PDF checksum, extracts chapter text and representative figures, builds `src/content/phak.json`, and rejects invalid citations, ACS tags, answer keys, numeric specifications, or image references.

Current bundle:

- 17 sections
- 51 microlessons
- 68 section-quiz questions
- 30 module-exam questions
- 51 glossary terms
- 17 bundled FAA figures
- 149 unique questions across multiple choice, numeric, matching, and image formats

## Sanity Studio

The standalone Studio lives in `studio/` and targets project `4qoowg94`, dataset `production`.
Use Node 24.18+ for Studio schema deployment (`cd studio && nvm use`); the app itself supports Node 22.13+.
The hosted CMS is available at https://preflight-content.sanity.studio/.

```sh
npm run studio
npm run studio:deploy-schema
```

After authenticating the Sanity CLI, seed the complete PHAK module and assets as idempotent drafts for review:

```sh
cd studio
npm run schema:deploy
npm run seed:phak:cli
```

Alternatively, provide a server-side Editor token only to the seed process:

```sh
cd studio
SANITY_AUTH_TOKEN=... npm run seed:phak
```

Never expose that token through an `EXPO_PUBLIC_` variable or bundle it into the app. The import creates or replaces 326 stable draft documents and uploads the content bundle, manifest, and 17 figures to Sanity's CDN. This intentionally preserves the PID's human-review gate; content is not auto-published.

Validate every live draft and its references with:

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
