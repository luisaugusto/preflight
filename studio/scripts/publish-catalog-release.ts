import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {createClient} from '@sanity/client'
import {format} from 'prettier'

import {
  API_VERSION,
  DATASET,
  PROJECT_ID,
  RELEASE_DATASET,
  canonicalContentPath,
  canonicalJson,
  curriculumCatalogSchema,
  documentId,
  keyFor,
  portableText,
  reference,
  requiredEnvironment,
  sha256,
} from './lib/content'

type Asset = {_id: string; url?: string}
type ExistingRelease = {
  _id: string
  bundleUrl?: string
  bundleSha256?: string
  assetManifestUrl?: string
}

async function retry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const waits = [750, 1500, 3000]
  let lastError: unknown
  for (let attempt = 0; attempt <= waits.length; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === waits.length) break
      console.warn(`${label} failed; retrying.`)
      await new Promise((resolve) => setTimeout(resolve, waits[attempt]))
    }
  }
  throw lastError
}

async function uploadJson(client: ReturnType<typeof createClient>, filename: string, raw: string): Promise<Asset> {
  return retry(`Upload ${filename}`, () =>
    client.assets.upload('file', Buffer.from(raw), {
      filename,
      contentType: 'application/json',
    }),
  ) as Promise<Asset>
}

async function main() {
  const inputArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'))
  const input = path.resolve(inputArgument ?? canonicalContentPath)
  const raw = await readFile(input, 'utf8')
  const catalog = curriculumCatalogSchema.parse(JSON.parse(raw))
  const canonicalRaw = await format(canonicalJson(catalog), {
    parser: 'json',
    printWidth: 100,
    singleQuote: true,
  })
  if (canonicalRaw !== raw) {
    throw new Error(`${input} is not in deterministic canonical JSON format.`)
  }

  const checksum = sha256(raw)
  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          status: 'validated',
          contentVersion: catalog.contentVersion,
          sourceDigest: catalog.sourceDigest,
          checksum,
          byteLength: Buffer.byteLength(raw),
        },
        null,
        2,
      ),
    )
    return
  }

  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token: requiredEnvironment('SANITY_AUTH_TOKEN'),
    useCdn: false,
    perspective: 'published',
  })
  const releaseClient = client.withConfig({dataset: RELEASE_DATASET})
  const releaseStableId = `content-${catalog.contentVersion
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
  const releaseId = documentId('contentRelease', releaseStableId)
  const existing = await client.fetch<ExistingRelease | null>(
    `*[_type == "contentRelease" && _id == $id][0]{
      _id, bundleUrl, bundleSha256, assetManifestUrl
    }`,
    {id: releaseId},
  )

  let bundleUrl = existing?.bundleSha256 === checksum ? existing.bundleUrl : undefined
  let manifestUrl = existing?.bundleSha256 === checksum ? existing.assetManifestUrl : undefined
  const createdAt = catalog.generatedAt

  if (!bundleUrl) {
    const bundleAsset = await uploadJson(client, `catalog-${catalog.contentVersion}.json`, raw)
    if (!bundleAsset.url) throw new Error('Sanity did not return a CDN URL for the bundle.')
    bundleUrl = bundleAsset.url
  }

  const manifest = {
    schemaVersion: catalog.schemaVersion,
    catalogId: catalog.catalogId,
    moduleIds: catalog.modules.map((module) => module.id),
    contentVersion: catalog.contentVersion,
    bundleUrl,
    checksum,
    algorithm: 'sha256' as const,
    byteLength: Buffer.byteLength(raw),
    createdAt,
    minimumAppVersion: catalog.minimumAppVersion,
  }
  const manifestRaw = canonicalJson(manifest)
  if (!manifestUrl) {
    const manifestAsset = await uploadJson(client, `manifest-${catalog.contentVersion}.json`, manifestRaw)
    if (!manifestAsset.url) throw new Error('Sanity did not return a CDN URL for the manifest.')
    manifestUrl = manifestAsset.url
  }

  const moduleRefs = catalog.modules.map((module, index) => ({
    ...reference('module', module.id, keyFor(`catalog-module-${module.id}`, index)),
  }))
  await client.createIfNotExists({
    _id: 'curriculumCatalog.current',
    _type: 'curriculumCatalog',
    stableId: catalog.catalogId,
    title: 'Preflight FAA curriculum',
    lifecycle: 'active',
    minimumAppVersion: catalog.minimumAppVersion,
    modules: moduleRefs,
  })

  const missingLifecycle = await client.fetch<Array<{_id: string}>>(
    `*[
      _type in $types &&
      !defined(lifecycle) &&
      !(_id in path("drafts.**"))
    ]{_id}`,
    {
      types: ['module', 'section', 'lesson', 'question', 'glossaryTerm', 'figure'],
    },
  )
  for (let offset = 0; offset < missingLifecycle.length; offset += 100) {
    let transaction = client.transaction()
    for (const document of missingLifecycle.slice(offset, offset + 100)) {
      transaction = transaction.patch(document._id, (patch) => patch.setIfMissing({lifecycle: 'active'}))
    }
    await retry(`Lifecycle migration ${offset + 1}`, () => transaction.commit({visibility: 'sync'}))
  }

  const release = {
    _id: releaseId,
    _type: 'contentRelease',
    stableId: releaseStableId,
    title: `FAA curriculum ${catalog.contentVersion}`,
    version: catalog.contentVersion,
    status: 'published',
    modules: catalog.modules.map((module, index) => ({
      ...reference('module', module.id, keyFor(`release-module-${module.id}`, index)),
    })),
    releaseNotes: portableText(
      `Published from the reviewed Sanity curriculum snapshot ${catalog.sourceDigest.slice(0, 12)}.`,
      `${releaseStableId}-notes`,
    ),
    publishedAt: createdAt,
    schemaVersion: catalog.schemaVersion,
    minimumAppVersion: catalog.minimumAppVersion,
    bundleUrl,
    bundleSha256: checksum,
    sourceDigest: catalog.sourceDigest,
    bundleByteLength: Buffer.byteLength(raw),
    assetManifestUrl: manifestUrl,
  }

  await retry('Publish immutable release record', () =>
    client.transaction().createOrReplace(release).commit({visibility: 'sync'}),
  )
  await retry('Advance public release pointer', () =>
    releaseClient
      .transaction()
      .createOrReplace({
        _id: 'curriculumReleasePointer.current',
        _type: 'curriculumReleasePointer',
        release: {_type: 'reference', _ref: releaseId, _weak: true},
        ...manifest,
      })
      .commit({visibility: 'sync'}),
  )

  console.log(
    JSON.stringify(
      {
        status: existing?.bundleSha256 === checksum ? 'pointer-refreshed' : 'published',
        releaseId,
        contentVersion: catalog.contentVersion,
        sourceDigest: catalog.sourceDigest,
        checksum,
        bundleUrl,
        manifestUrl,
        releaseDataset: RELEASE_DATASET,
        lifecycleDocumentsMigrated: missingLifecycle.length,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
