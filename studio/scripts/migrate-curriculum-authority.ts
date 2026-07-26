import {createClient} from '@sanity/client'

import {API_VERSION, DATASET, PROJECT_ID, documentId, keyFor, reference, requiredEnvironment} from './lib/content'

type LegacyCatalog = {
  catalogId: string
  modules: Array<{
    id: string
    sections: Array<{
      id: string
      lessons: Array<{practice: {id: string; sectionId?: string}}>
      quiz: Array<{id: string; sectionId?: string}>
    }>
    exam: Array<{id: string; sectionId?: string}>
  }>
}

function questionSections(catalog: LegacyCatalog): Map<string, string> {
  const result = new Map<string, string>()
  const add = (question: {id: string; sectionId?: string}, fallback: string) => {
    result.set(question.id, question.sectionId ?? fallback)
  }
  for (const module of catalog.modules) {
    for (const section of module.sections) {
      for (const lesson of section.lessons) add(lesson.practice, section.id)
      for (const question of section.quiz) add(question, section.id)
    }
    for (const question of module.exam) {
      if (!question.sectionId) {
        throw new Error(`Legacy exam question ${question.id} has no section provenance.`)
      }
      add(question, question.sectionId)
    }
  }
  return result
}

async function main() {
  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token: requiredEnvironment('SANITY_AUTH_TOKEN'),
    useCdn: false,
    perspective: 'published',
  })
  const release = await client.fetch<{bundleUrl: string; version: string} | null>(
    `*[
      _type == "contentRelease" &&
      status == "published" &&
      defined(bundleUrl)
    ] | order(publishedAt desc)[0]{bundleUrl, version}`,
  )
  if (!release) throw new Error('No published curriculum release is available to migrate.')
  const response = await fetch(release.bundleUrl)
  if (!response.ok) throw new Error(`Unable to download release: HTTP ${response.status}`)
  const catalog = (await response.json()) as LegacyCatalog
  if (!catalog.catalogId || !Array.isArray(catalog.modules) || !catalog.modules.length) {
    throw new Error('The published release is not a complete curriculum catalog.')
  }

  const sectionByQuestion = questionSections(catalog)
  const documents = await client.fetch<
    Array<{_id: string; _type: string; stableId?: string; lifecycle?: string; sectionId?: string}>
  >(
    `*[
      _type in $types &&
      !(_id in path("drafts.**"))
    ]{
      _id,
      _type,
      stableId,
      lifecycle,
      "sectionId": section->stableId
    }`,
    {
      types: ['module', 'section', 'lesson', 'question', 'glossaryTerm', 'figure'],
    },
  )

  const changes = documents.filter((document) => {
    const expectedSection =
      document._type === 'question' && document.stableId ? sectionByQuestion.get(document.stableId) : undefined
    return document.lifecycle !== 'active' || (expectedSection !== undefined && expectedSection !== document.sectionId)
  })
  for (let offset = 0; offset < changes.length; offset += 100) {
    let transaction = client.transaction()
    for (const document of changes.slice(offset, offset + 100)) {
      const expectedSection =
        document._type === 'question' && document.stableId ? sectionByQuestion.get(document.stableId) : undefined
      transaction = transaction.patch(document._id, (patch) =>
        patch
          .setIfMissing({lifecycle: 'active'})
          .set(
            expectedSection && expectedSection !== document.sectionId
              ? {section: reference('section', expectedSection)}
              : {},
          ),
      )
    }
    await transaction.commit({visibility: 'sync'})
  }

  await client.createIfNotExists({
    _id: 'curriculumCatalog.current',
    _type: 'curriculumCatalog',
    stableId: catalog.catalogId,
    title: 'Preflight FAA curriculum',
    lifecycle: 'active',
    minimumAppVersion: '1.0.0',
    modules: catalog.modules.map((module, index) => ({
      ...reference('module', module.id, keyFor(`catalog-module-${module.id}`, index)),
    })),
  })

  console.log(
    JSON.stringify(
      {
        status: 'migrated',
        baselineVersion: release.version,
        modules: catalog.modules.map((module) => module.id),
        lifecycleOrProvenanceChanges: changes.length,
        catalogDocumentId: 'curriculumCatalog.current',
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
