import {mkdir, rename, writeFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import path from 'node:path'
import {createClient, type SanityClient} from '@sanity/client'
import {format} from 'prettier'

import {
  API_VERSION,
  DATASET,
  PROJECT_ID,
  canonicalJson,
  curriculumCatalogSchema,
  fromSanityCitation,
  portableTextToPlain,
  repositoryRoot,
  sha256,
  type CanonicalQuestion,
  type CurriculumCatalog,
  type ModuleContent,
} from './lib/content'

type Document = Record<string, unknown> & {
  _id: string
  _type: string
  _updatedAt?: string
}

type ExportOptions = {
  output: string
  dryRun: boolean
  requireRecentUpdates?: number
}

const SOURCE_TYPES = [
  'curriculumCatalog',
  'module',
  'section',
  'lesson',
  'question',
  'glossaryTerm',
  'figure',
  'acsCode',
] as const

function options(argv: string[]): ExportOptions {
  const value = (flag: string) => {
    const index = argv.indexOf(flag)
    if (index < 0) return undefined
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) throw new Error(`${flag} requires a value.`)
    return next
  }
  const recent = value('--require-recent-updates')
  return {
    output: path.resolve(value('--out') ?? path.join(repositoryRoot, 'src/content/catalog.json')),
    dryRun: argv.includes('--dry-run'),
    ...(recent ? {requireRecentUpdates: Number(recent)} : {}),
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`)
  }
  return value as Record<string, unknown>
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}.`)
  return value
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Missing ${label}.`)
  return value
}

function refId(value: unknown, label: string): string {
  return text(object(value, label)._ref, `${label} reference ID`)
}

function refIds(value: unknown): string[] {
  return array(value).map((item, index) => refId(item, `reference ${index + 1}`))
}

function active(document: Document): boolean {
  return document.lifecycle !== 'retired' && document.active !== false
}

function indexById(documents: Document[]): Map<string, Document> {
  return new Map(documents.map((document) => [document._id, document]))
}

function get(index: Map<string, Document>, reference: unknown, label: string): Document {
  const id = refId(reference, label)
  const document = index.get(id)
  if (!document) throw new Error(`Missing published ${label}: ${id}`)
  return document
}

function getActiveMany(index: Map<string, Document>, references: unknown, label: string): Document[] {
  return array(references)
    .map((reference, itemIndex) => get(index, reference, `${label} ${itemIndex + 1}`))
    .filter(active)
}

function firstCitation(document: Document) {
  const citation = array(document.citations)[0] ?? document.citation
  return fromSanityCitation(object(citation, `${document._type} ${document._id} citation`))
}

function acsCodes(document: Document, index: Map<string, Document>): string[] {
  return getActiveMany(index, document.acsCodes, 'ACS code').map((item) => text(item.code, `ACS code ${item._id}`))
}

function answerOptions(value: unknown, questionId: string) {
  const spec = object(value, `answer specification for ${questionId}`)
  const values = array(spec.options).map((item, index) => {
    const option = object(item, `answer option ${index + 1} for ${questionId}`)
    return {
      id: text(option.optionId, `answer option ID for ${questionId}`),
      text: text(option.text, `answer option text for ${questionId}`),
    }
  })
  const correctId = text(spec.correctOptionId, `correct option ID for ${questionId}`)
  const correctIndex = values.findIndex((item) => item.id === correctId)
  if (correctIndex < 0) throw new Error(`Question ${questionId} has an invalid correct option ID.`)
  return {options: values.map((item) => item.text), correctIndex}
}

function question(document: Document, documents: Map<string, Document>, moduleId: string): CanonicalQuestion {
  if (!active(document)) {
    throw new Error(`Active curriculum references retired question ${document._id}.`)
  }
  const id = text(document.stableId, `stable ID for ${document._id}`)
  const section = get(documents, document.section, `section for ${id}`)
  const base = {
    id,
    lifecycle: 'active' as const,
    moduleId,
    sectionId: text(section.stableId, `section stable ID for ${id}`),
    prompt: portableTextToPlain(document.prompt),
    explanation: portableTextToPlain(document.explanation),
    sourceCitation: firstCitation(document),
    acsCodes: acsCodes(document, documents),
  }
  const type = text(document.questionType, `question type for ${id}`)
  if (type === 'multipleChoice') {
    return {...base, type, ...answerOptions(document.multipleChoiceAnswer, id)}
  }
  if (type === 'image') {
    const spec = object(document.imageAnswer, `image answer for ${id}`)
    const figure = get(documents, spec.stimulusFigure, `figure for ${id}`)
    if (!active(figure)) throw new Error(`Active question ${id} references retired figure.`)
    const image = object(figure.image, `image for ${id}`)
    const asset = object(image.asset, `image asset for ${id}`)
    const source = firstCitation(figure)
    const localUri =
      typeof figure.originalFilename === 'string' && figure.originalFilename
        ? `assets/${moduleId}/${path.basename(figure.originalFilename)}`
        : undefined
    return {
      ...base,
      type,
      image: {
        uri:
          localUri && existsSync(path.join(repositoryRoot, localUri))
            ? localUri
            : text(asset.url, `figure CDN URL for ${id}`),
        alt: text(image.alt, `figure alt text for ${id}`),
        caption: text(figure.caption, `figure caption for ${id}`),
        sourcePage: source.page,
      },
      ...answerOptions(spec.answer, id),
    }
  }
  if (type === 'numeric') {
    const spec = object(document.numericAnswer, `numeric answer for ${id}`)
    return {
      ...base,
      type,
      answer: {
        value: number(spec.value, `numeric value for ${id}`),
        tolerance: number(spec.tolerance, `numeric tolerance for ${id}`),
        unit: text(spec.unit, `numeric unit for ${id}`),
        ...(array(spec.acceptedFormats).length ? {acceptedFormats: array(spec.acceptedFormats).map(String)} : {}),
      },
    }
  }
  if (type === 'matching') {
    const spec = object(document.matchingAnswer, `matching answer for ${id}`)
    return {
      ...base,
      type,
      pairs: array(spec.pairs).map((value, index) => {
        const pair = object(value, `matching pair ${index + 1} for ${id}`)
        return {
          id: text(pair.pairId, `matching pair ID for ${id}`),
          left: text(object(pair.left, `left item for ${id}`).label, `left label for ${id}`),
          right: text(object(pair.right, `right item for ${id}`).label, `right label for ${id}`),
        }
      }),
    }
  }
  throw new Error(`Unsupported question type ${JSON.stringify(type)} for ${id}.`)
}

function lessonBlock(document: Document, type: string): string {
  const result = array(document.content)
    .filter((value) => object(value, `lesson block for ${document._id}`).blockType === type)
    .map((value) => portableTextToPlain(object(value, `lesson ${type} block`).body))
    .filter(Boolean)
    .join('\n\n')
  if (!result) throw new Error(`Lesson ${document._id} is missing its ${type} block.`)
  return result
}

function moduleFromDocument(
  moduleDocument: Document,
  documents: Map<string, Document>,
  version: string,
): ModuleContent {
  const moduleId = text(moduleDocument.stableId, `stable ID for ${moduleDocument._id}`)
  const convertQuestion = (reference: unknown) =>
    question(get(documents, reference, `question in ${moduleId}`), documents, moduleId)
  const sections = getActiveMany(documents, moduleDocument.sections, `section in ${moduleId}`).map((section, sectionIndex) => {
    if (refId(section.module, `parent module for ${section._id}`) !== moduleDocument._id) {
      throw new Error(`Section ${section._id} does not point back to module ${moduleId}.`)
    }
    const sectionId = text(section.stableId, `stable ID for ${section._id}`)
    const lessons = getActiveMany(documents, section.lessons, `lesson in ${sectionId}`).map((lesson, lessonIndex) => {
      if (refId(lesson.section, `parent section for ${lesson._id}`) !== section._id) {
        throw new Error(`Lesson ${lesson._id} does not point back to section ${sectionId}.`)
      }
      const reviewQuestion = array(lesson.reviewQuestions)[0]
      if (!reviewQuestion) throw new Error(`Lesson ${lesson._id} has no practice question.`)
      return {
        id: text(lesson.stableId, `stable ID for ${lesson._id}`),
        lifecycle: 'active' as const,
        isRequired: lesson.isRequired !== false,
        title: text(lesson.title, `title for ${lesson._id}`),
        order: lessonIndex + 1,
        estimatedMinutes: number(lesson.estimatedMinutes, `estimated minutes for ${lesson._id}`),
        concept: lessonBlock(lesson, 'concept'),
        explanation: lessonBlock(lesson, 'explanation'),
        workedExample: lessonBlock(lesson, 'workedExample'),
        sourceCitation: firstCitation(lesson),
        acsCodes: acsCodes(lesson, documents),
        practice: convertQuestion(reviewQuestion),
      }
    })
    if (!lessons.length) throw new Error(`Active section ${sectionId} has no active lessons.`)
    const quiz = getActiveMany(documents, section.quizQuestions, `quiz question in ${sectionId}`).map((item) =>
      question(item, documents, moduleId),
    )
    if (!quiz.length) throw new Error(`Active section ${sectionId} has no active quiz questions.`)
    return {
      id: sectionId,
      lifecycle: 'active' as const,
      title: text(section.title, `title for ${section._id}`),
      order: sectionIndex + 1,
      summary: portableTextToPlain(section.summary),
      sourcePages: text(section.sourcePages, `source pages for ${section._id}`),
      acsCodes: acsCodes(section, documents),
      lessons,
      quiz,
    }
  })
  if (!sections.length) throw new Error(`Active module ${moduleId} has no active sections.`)

  const glossary = getActiveMany(documents, moduleDocument.glossaryTerms, `glossary term in ${moduleId}`).map(
    (term) => {
      const section = get(documents, array(term.sections)[0], `section for glossary ${term._id}`)
      return {
        id: text(term.stableId, `stable ID for ${term._id}`),
        lifecycle: 'active' as const,
        moduleId,
        term: text(term.term, `term for ${term._id}`),
        definition: portableTextToPlain(term.definition),
        sectionId: text(section.stableId, `section stable ID for ${term._id}`),
        sourceCitation: firstCitation(term),
        acsCodes: acsCodes(term, documents),
      }
    },
  )
  const citation = firstCitation(moduleDocument)
  return {
    id: moduleId,
    lifecycle: 'active',
    title: text(moduleDocument.title, `title for ${moduleDocument._id}`),
    shortTitle:
      typeof moduleDocument.subtitle === 'string' && moduleDocument.subtitle
        ? moduleDocument.subtitle
        : text(moduleDocument.title, `title for ${moduleDocument._id}`),
    description: portableTextToPlain(moduleDocument.description),
    version,
    source: {
      title: citation.handbook,
      url: text(moduleDocument.sourcePdfUrl, `source URL for ${moduleDocument._id}`),
      edition: text(moduleDocument.edition, `edition for ${moduleDocument._id}`),
      checksum: text(moduleDocument.sourceChecksum, `source checksum for ${moduleDocument._id}`),
    },
    sections,
    exam: getActiveMany(documents, moduleDocument.finalExamQuestions, `exam question in ${moduleId}`).map((item) =>
      question(item, documents, moduleId),
    ),
    glossary,
  }
}

async function loadSource(client: SanityClient): Promise<{
  catalog: Document
  modules: Document[]
  documents: Map<string, Document>
}> {
  const all = await client.fetch<Document[]>(
    `*[_type in $types && !(_id in path("drafts.**"))]{
      ...,
      image{..., asset->{_id, url}}
    }`,
    {types: SOURCE_TYPES},
  )
  const documents = indexById(all)
  let catalog = all.find(
    (document) => document._type === 'curriculumCatalog' && document._id === 'curriculumCatalog.current',
  )
  if (!catalog) {
    const legacyOrder = new Map([
      ['phak', 0],
      ['afh', 1],
      ['awh', 2],
      ['rmh', 3],
    ])
    const fallbackModules = all
      .filter((document) => document._type === 'module' && document.status === 'published' && active(document))
      .sort((left, right) => {
        const leftId = text(left.stableId, 'module stable ID')
        const rightId = text(right.stableId, 'module stable ID')
        return (
          (legacyOrder.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
            (legacyOrder.get(rightId) ?? Number.MAX_SAFE_INTEGER) || leftId.localeCompare(rightId)
        )
      })
    catalog = {
      _id: 'curriculumCatalog.current',
      _type: 'curriculumCatalog',
      stableId: 'preflight-faa-curriculum',
      title: 'Preflight FAA curriculum',
      lifecycle: 'active',
      minimumAppVersion: '1.0.0',
      modules: fallbackModules.map((module) => ({_type: 'reference', _ref: module._id})),
    }
  }
  if (!active(catalog)) throw new Error('The authoritative curriculum catalog is retired.')
  const modules = getActiveMany(documents, catalog.modules, 'catalog module')
  if (!modules.length) throw new Error('The authoritative curriculum catalog has no active modules.')
  return {catalog, modules, documents}
}

async function atomicWrite(filename: string, raw: string) {
  await mkdir(path.dirname(filename), {recursive: true})
  const temporary = `${filename}.tmp`
  await writeFile(temporary, raw, 'utf8')
  await rename(temporary, filename)
}

async function main() {
  const selected = options(process.argv.slice(2))
  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token: process.env.SANITY_AUTH_TOKEN,
    useCdn: false,
    perspective: 'published',
  })

  if (selected.requireRecentUpdates !== undefined) {
    if (!Number.isInteger(selected.requireRecentUpdates) || selected.requireRecentUpdates < 1) {
      throw new Error('--require-recent-updates must be a positive number of days.')
    }
    const count = await client.fetch<number>(
      `count(*[
        _type in $types &&
        !(_id in path("drafts.**")) &&
        _updatedAt > dateTime(now()) - $seconds
      ])`,
      {types: SOURCE_TYPES, seconds: selected.requireRecentUpdates * 86_400},
    )
    if (count === 0) {
      console.log(
        JSON.stringify({
          status: 'no-recent-updates',
          days: selected.requireRecentUpdates,
        }),
      )
      return
    }
  }

  const source = await loadSource(client)
  const sourceUpdatedAt = [...source.documents.values()]
    .filter((document) => SOURCE_TYPES.includes(document._type as (typeof SOURCE_TYPES)[number]))
    .map((document) => document._updatedAt)
    .filter((value): value is string => typeof value === 'string')
    .sort()
    .at(-1)
  if (!sourceUpdatedAt) throw new Error('Published curriculum has no source update timestamp.')

  const provisionalModules = source.modules.map((module) => moduleFromDocument(module, source.documents, 'pending'))
  const catalogId = text(source.catalog.stableId, 'catalog stable ID')
  const minimumAppVersion =
    typeof source.catalog.minimumAppVersion === 'string' ? source.catalog.minimumAppVersion : '1.0.0'
  const sourceDigest = sha256(canonicalJson({catalogId, minimumAppVersion, modules: provisionalModules}))
  const matchingRelease = await client.fetch<{version: string; publishedAt: string} | null>(
    `*[
      _type == "contentRelease" &&
      status == "published" &&
      sourceDigest == $sourceDigest
    ] | order(publishedAt desc)[0]{version, publishedAt}`,
    {sourceDigest},
  )
  const day = sourceUpdatedAt.slice(0, 10).replaceAll('-', '.')
  const time = sourceUpdatedAt.slice(11, 19).replaceAll(':', '')
  const contentVersion =
    matchingRelease?.version ?? `${day}-sanity.${time}.${sourceDigest.slice(0, 8)}`
  const generatedAt = matchingRelease?.publishedAt ?? sourceUpdatedAt
  const modules = provisionalModules.map((module) => ({...module, version: contentVersion}))
  const catalog: CurriculumCatalog = {
    schemaVersion: 3,
    catalogId,
    contentVersion,
    generatedAt,
    sourceDigest,
    minimumAppVersion,
    modules,
  }
  const validated = curriculumCatalogSchema.parse(catalog)
  const raw = await format(canonicalJson(validated), {
    parser: 'json',
    printWidth: 100,
    singleQuote: true,
  })
  if (!selected.dryRun) await atomicWrite(selected.output, raw)

  console.log(
    JSON.stringify(
      {
        status: selected.dryRun ? 'validated' : 'exported',
        output: selected.output,
        contentVersion,
        sourceDigest,
        checksum: sha256(raw),
        modules: modules.length,
        sections: modules.reduce((total, module) => total + module.sections.length, 0),
        lessons: modules.reduce(
          (total, module) =>
            total + module.sections.reduce((sectionTotal, section) => sectionTotal + section.lessons.length, 0),
          0,
        ),
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
