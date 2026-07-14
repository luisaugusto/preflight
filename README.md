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

`eas.json` contains development, preview, and production profiles. Build numbers
are managed server-side (`cli.appVersionSource: "remote"`) and the production
profile sets `autoIncrement: true`, so every production build gets a unique,
monotonic build number with no manual bumping and no collisions.

Two build paths are automated:

- **Preview build on merge** — [.github/workflows/eas-preview.yml](./.github/workflows/eas-preview.yml)
  builds the `preview` profile after CI passes on `main`.
- **Production release on tag** — [.github/workflows/eas-release.yml](./.github/workflows/eas-release.yml)
  (below).

A one-off preview build can also be run by hand:

```sh
npx eas build --platform ios --profile preview
```

### Automated App Store submission

Pushing a version tag ships a release:

```sh
git tag v1.2.0
git push origin v1.2.0
```

That triggers [eas-release.yml](./.github/workflows/eas-release.yml), which, in
strict order:

1. **Re-runs the full quality gate** on the tagged commit (it calls
   [ci.yml](./.github/workflows/ci.yml) as a reusable workflow). Nothing builds
   or submits unless this is green.
2. **Builds** the `production` profile on EAS and **submits that exact build** to
   App Store Connect / TestFlight with `eas submit --platform ios --non-interactive`.
   Any failure is a hard, red, notifying failure — never silent.
3. **Publishes a GitHub Release** for the tag with notes generated from the
   merged PRs/commits since the previous tag.

#### Do the first submission by hand — this is not optional

**Never let this workflow be the first time the app reaches App Store Connect.**
Build and submit to TestFlight manually once first:

```sh
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

Signing, provisioning profiles, capability mismatches, and API-key permissions
all fail in ways CI logs describe badly and misleadingly. A non-interactive CI
build also cannot _create_ missing iOS credentials — it can only reuse what the
manual build already stored on EAS. Do it by hand once, understand each failure
in the EAS/Xcode output, and only then rely on the tag pipeline.

#### Required GitHub secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret               | What it is                                                           |
| -------------------- | -------------------------------------------------------------------- |
| `EXPO_TOKEN`         | Expo personal access token (**Account → Settings → Access tokens**). |
| `ASC_API_KEY_BASE64` | The App Store Connect API key `.p8`, base64-encoded (see below).     |
| `ASC_KEY_ID`         | The API key's **Key ID**.                                            |
| `ASC_ISSUER_ID`      | The API key's **Issuer ID**.                                         |

Create the App Store Connect API key under **App Store Connect → Users and
Access → Integrations → App Store Connect API** (an **App Manager** role is
enough to submit). You download the `.p8` **once** — store it safely. Encode it
for the secret with:

```sh
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy   # macOS; paste into ASC_API_KEY_BASE64
```

The workflow decodes the key into `RUNNER_TEMP` at run time and passes all three
values to `eas submit` through the `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`,
and `EXPO_ASC_ISSUER_ID` environment variables. No Apple credentials are ever
committed — `eas.json` holds none. The app to submit to is resolved from the
`ios.bundleIdentifier` in [app.json](./app.json); if you ever need to pin it
explicitly, add a non-secret `ascAppId` to `submit.production.ios` in `eas.json`.
