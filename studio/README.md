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

## Catalog ingestion

The importer reads `../src/content/catalog.json` plus all four module asset directories, uploads 89 representative figures and a schema-v2 JSON bundle, then creates deterministic documents. Re-running it updates the same IDs instead of producing duplicates.

```sh
# Fully validate the published-document shape without network writes or a token
npm run seed:catalog:dry-run

# Publish all four modules (requires a server-side Editor token)
SANITY_AUTH_TOKEN=... npm run seed:catalog -- --publish

# Or use the authenticated Sanity CLI session
npm run seed:catalog:cli
```

The token is read only from the environment and is never printed. With `--publish`, the seed command writes published IDs in project `4qoowg94`, dataset `production`; without it, the command writes review drafts.

Draft references are weakened so the cyclic curriculum graph can be staged safely. Published imports retain the schema's intended references, while Sanity image/file asset references remain strong in both modes.

Validate the complete live dataset after an import:

```sh
npx sanity documents validate --workspace preflight --yes --level warning
```

For an additional local validation artifact, pass `--ndjson <path>` to the dry run. Validating that file with `sanity documents validate --file` still requires an authenticated Sanity CLI session.

## Content bundle export

The legacy module exporter reads published Sanity documents, reconstructs and validates one module, and atomically writes `exports/<module-id>.json` plus `exports/manifest.json` with a SHA-256 checksum. Runtime delivery uses the schema-v2 catalog uploaded by the catalog importer.

```sh
npm run export:bundle:dry-run
npm run export:bundle

# Optional overrides
npm run export:bundle -- --module-id phak --out-dir ./exports --bundle-url https://example.com/phak.json
```

If the reconstructed bundle matches the published `contentRelease` checksum, its Sanity CDN URL is reused. Otherwise, provide the final hosting URL with `--bundle-url` or `PREFLIGHT_CONTENT_BUNDLE_URL` so the manifest cannot point at bytes with a different checksum.
