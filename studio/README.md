# Preflight Content Studio

Standalone Sanity Studio for the Preflight learning app.

- Project: `4qoowg94`
- Dataset: `production`
- Local Studio: `npm run dev`
- Hosted Studio: https://preflight-content.sanity.studio/
- Schema deployment runtime: Node 24.18+ (`nvm use` in this directory)

## Commands

```sh
npm run dev
npm run schema:validate
npm run typegen
npm run build
npm run schema:deploy
```

Schema deployment requires a logged-in Sanity CLI session with access to the project, or a suitable `SANITY_AUTH_TOKEN`.

## PHAK ingestion

The importer reads `../src/content/phak.json` and `../assets/phak`, uploads the representative figures and a canonical JSON bundle, then seeds deterministic draft documents for human review. Re-running it updates the same draft IDs instead of producing duplicates.

```sh
# Fully validate and compile the import without network writes or a token
npm run seed:phak:dry-run

# Seed assets and draft documents (requires a server-side Editor token)
SANITY_AUTH_TOKEN=... npm run seed:phak

# Or use the authenticated Sanity CLI session
npm run seed:phak:cli
```

The token is read only from the environment and is never printed. The seed command writes to `drafts.*` IDs in project `4qoowg94`, dataset `production`; generated content is not auto-published.

The curriculum graph is cyclic and draft-only during editorial review, so explicit content references are schema-weak and stored with `_weak: true`; Sanity image/file asset references remain strong. This lets all related drafts coexist without publishing generated learning content. If strong references are required after review, use a deliberate two-phase release that publishes every target before strengthening references.

Validate the complete live dataset after an import:

```sh
npx sanity documents validate --workspace preflight --yes --level warning
```

For an additional local validation artifact, pass `--ndjson <path>` to the dry run. Validating that file with `sanity documents validate --file` still requires an authenticated Sanity CLI session.

## Content bundle export

The exporter reads only published Sanity documents, reconstructs the app's canonical `ModuleContent`, validates it, and atomically writes `exports/phak.json` plus `exports/manifest.json` with a SHA-256 checksum.

```sh
npm run export:bundle:dry-run
npm run export:bundle

# Optional overrides
npm run export:bundle -- --module-id phak --out-dir ./exports --bundle-url https://example.com/phak.json
```

If the reconstructed bundle matches the published `contentRelease` checksum, its Sanity CDN URL is reused. Otherwise, provide the final hosting URL with `--bundle-url` or `PREFLIGHT_CONTENT_BUNDLE_URL` so the manifest cannot point at bytes with a different checksum.
