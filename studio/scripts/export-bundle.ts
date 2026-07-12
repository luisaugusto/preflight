import {mkdir, rename, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createClient} from '@sanity/client'

import {
  API_VERSION,
  DATASET,
  PROJECT_ID,
  canonicalJson,
  fromSanityCitation,
  moduleContentSchema,
  portableTextToPlain,
  sha256,
  studioRoot,
  type CanonicalQuestion,
  type ModuleContent,
} from './lib/content'

type UnknownDocument = Record<string, unknown> & {_id: string; _type: string}
type ReferenceValue = {_ref: string}

type ExportOptions = {
  dryRun: boolean
  moduleId: string
  outputDirectory: string
  bundleUrl?: string
}

function parseArguments(argv: string[]): ExportOptions {
  const readValue = (flag: string) => {
    const index = argv.indexOf(flag)
    if (index < 0) return undefined
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`)
    return value
  }

  return {
    dryRun: argv.includes('--dry-run'),
    moduleId: readValue('--module-id') ?? 'phak',
    outputDirectory: path.resolve(readValue('--out-dir') ?? path.join(studioRoot, 'exports')),
    bundleUrl: readValue('--bundle-url') ?? process.env.PREFLIGHT_CONTENT_BUNDLE_URL,
  }
}

function record(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${description} to be an object.`)
  }
  return value as Record<string, unknown>
}

function stringValue(value: unknown, description: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${description}.`)
  return value
}

function numberValue(value: unknown, description: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Missing ${description}.`)
  return value
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function referenceId(value: unknown, description: string): string {
  const referenceValue = record(value, description)
  return stringValue(referenceValue._ref, `${description} reference ID`)
}

function referenceIds(value: unknown): string[] {
  return arrayValue(value).map((item, index) => referenceId(item, `reference ${index + 1}`))
}

function indexDocuments(documents: UnknownDocument[]): Map<string, UnknownDocument> {
  return new Map(documents.map((document) => [document._id, document]))
}

function dereference(
  index: Map<string, UnknownDocument>,
  reference: unknown,
  description: string,
): UnknownDocument {
  const id = referenceId(reference, description)
  const document = index.get(id)
  if (!document) throw new Error(`Missing published ${description}: ${id}`)
  return document
}

function dereferenceMany(
  index: Map<string, UnknownDocument>,
  references: unknown,
  description: string,
): UnknownDocument[] {
  return arrayValue(references).map((reference, itemIndex) =>
    dereference(index, reference, `${description} ${itemIndex + 1}`),
  )
}

function firstCitation(document: UnknownDocument) {
  const value = arrayValue(document.citations)[0] ?? document.citation
  return fromSanityCitation(record(value, `${document._type} ${document._id} source citation`))
}

function acsCodesFor(
  document: UnknownDocument,
  acsIndex: Map<string, UnknownDocument>,
): string[] {
  return dereferenceMany(acsIndex, document.acsCodes, 'ACS code').map((acsDocument) =>
    stringValue(acsDocument.code, `ACS code ${acsDocument._id}`),
  )
}

function answerOptions(specValue: unknown, questionId: string) {
  const spec = record(specValue, `answer specification for ${questionId}`)
  const options = arrayValue(spec.options).map((value, index) => {
    const option = record(value, `answer option ${index + 1} for ${questionId}`)
    return {
      optionId: stringValue(option.optionId, `answer option ID for ${questionId}`),
      text: stringValue(option.text, `answer option text for ${questionId}`),
    }
  })
  const correctOptionId = stringValue(spec.correctOptionId, `correct option ID for ${questionId}`)
  const correctIndex = options.findIndex((option) => option.optionId === correctOptionId)
  if (correctIndex < 0) throw new Error(`Question ${questionId} has an invalid correct option ID.`)
  return {options: options.map((option) => option.text), correctIndex}
}

function questionFromDocument(
  document: UnknownDocument,
  acsIndex: Map<string, UnknownDocument>,
  figureIndex: Map<string, UnknownDocument>,
): CanonicalQuestion {
  const id = stringValue(document.stableId, `stable ID for ${document._id}`)
  const type = stringValue(document.questionType, `question type for ${id}`)
  const base = {
    id,
    prompt: portableTextToPlain(document.prompt),
    explanation: portableTextToPlain(document.explanation),
    sourceCitation: firstCitation(document),
    acsCodes: acsCodesFor(document, acsIndex),
  }

  if (type === 'multipleChoice') {
    const answer = answerOptions(document.multipleChoiceAnswer, id)
    return {...base, type, ...answer}
  }

  if (type === 'image') {
    const imageSpec = record(document.imageAnswer, `image answer specification for ${id}`)
    const answer = answerOptions(imageSpec.answer, id)
    const figure = dereference(figureIndex, imageSpec.stimulusFigure, `figure for ${id}`)
    const image = record(figure.image, `image for figure ${figure._id}`)
    const imageAsset = record(image.asset, `asset for figure ${figure._id}`)
    const asset = imageAsset
    const citation = firstCitation(figure)
    const originalFilename =
      typeof figure.originalFilename === 'string' && figure.originalFilename
        ? `assets/phak/${path.basename(figure.originalFilename)}`
        : undefined
    return {
      ...base,
      type,
      image: {
        uri: originalFilename ?? stringValue(asset.url, `CDN URL for figure ${figure._id}`),
        alt: stringValue(image.alt, `alternative text for figure ${figure._id}`),
        caption: stringValue(figure.caption, `caption for figure ${figure._id}`),
        sourcePage: citation.page,
      },
      ...answer,
    }
  }

  if (type === 'numeric') {
    const numeric = record(document.numericAnswer, `numeric answer specification for ${id}`)
    return {
      ...base,
      type,
      answer: {
        value: numberValue(numeric.value, `numeric value for ${id}`),
        tolerance: numberValue(numeric.tolerance, `numeric tolerance for ${id}`),
        unit: stringValue(numeric.unit, `numeric unit for ${id}`),
        ...(arrayValue(numeric.acceptedFormats).length
          ? {acceptedFormats: arrayValue(numeric.acceptedFormats).map((value) => String(value))}
          : {}),
      },
    }
  }

  if (type === 'matching') {
    const matching = record(document.matchingAnswer, `matching answer specification for ${id}`)
    return {
      ...base,
      type,
      pairs: arrayValue(matching.pairs).map((value, index) => {
        const pair = record(value, `matching pair ${index + 1} for ${id}`)
        return {
          id: stringValue(pair.pairId, `matching pair ID for ${id}`),
          left: stringValue(record(pair.left, `left item for ${id}`).label, `left label for ${id}`),
          right: stringValue(record(pair.right, `right item for ${id}`).label, `right label for ${id}`),
        }
      }),
    }
  }

  throw new Error(`Unsupported published question type ${JSON.stringify(type)} for ${id}.`)
}

function blockText(document: UnknownDocument, blockType: string): string {
  const matchingBlocks = arrayValue(document.content).filter(
    (value) => record(value, `lesson content block for ${document._id}`).blockType === blockType,
  )
  const text = matchingBlocks
    .map((value) => portableTextToPlain(record(value, `lesson ${blockType} block`).body))
    .filter(Boolean)
    .join('\n\n')
  if (!text) throw new Error(`Lesson ${document._id} is missing its ${blockType} content block.`)
  return text
}

async function atomicWrite(filename: string, raw: string) {
  const temporary = `${filename}.tmp`
  await writeFile(temporary, raw, 'utf8')
  await rename(temporary, filename)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          projectId: PROJECT_ID,
          dataset: DATASET,
          moduleId: options.moduleId,
          outputDirectory: options.outputDirectory,
          queryPerspective: 'published',
          writes: 0,
          mutations: 0,
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
    token: process.env.SANITY_AUTH_TOKEN,
    useCdn: false,
    perspective: 'published',
  })

  const moduleDocument = await client.fetch<UnknownDocument | null>(
    `*[
      _type == "module" &&
      stableId == $moduleId &&
      status == "published" &&
      !(_id in path("drafts.**"))
    ][0]`,
    {moduleId: options.moduleId},
  )
  if (!moduleDocument) {
    throw new Error(`No published module with stableId ${JSON.stringify(options.moduleId)} was found.`)
  }

  const sectionIds = referenceIds(moduleDocument.sections)
  const glossaryIds = referenceIds(moduleDocument.glossaryTerms)
  const sections = await client.fetch<UnknownDocument[]>(`*[_id in $ids]`, {ids: sectionIds})
  const sectionIndex = indexDocuments(sections)
  const lessonIds = sections.flatMap((section) => referenceIds(section.lessons))
  const lessons = await client.fetch<UnknownDocument[]>(`*[_id in $ids]`, {ids: lessonIds})
  const lessonIndex = indexDocuments(lessons)

  const questionIds = uniqueStrings([
    ...referenceIds(moduleDocument.finalExamQuestions),
    ...sections.flatMap((section) => referenceIds(section.quizQuestions)),
    ...lessons.flatMap((lesson) => [
      ...referenceIds(lesson.reviewQuestions),
      ...arrayValue(lesson.content)
        .map((value) => record(value, `lesson content block for ${lesson._id}`).practiceQuestion)
        .filter(Boolean)
        .map((value) => referenceId(value, `practice question for ${lesson._id}`)),
    ]),
  ])
  const questions = await client.fetch<UnknownDocument[]>(`*[_id in $ids]`, {ids: questionIds})
  const questionIndex = indexDocuments(questions)

  const glossary = await client.fetch<UnknownDocument[]>(`*[_id in $ids]`, {ids: glossaryIds})
  const glossaryIndex = indexDocuments(glossary)
  const acsIds = uniqueStrings([
    ...referenceIds(moduleDocument.acsCodes),
    ...sections.flatMap((section) => referenceIds(section.acsCodes)),
    ...lessons.flatMap((lesson) => referenceIds(lesson.acsCodes)),
    ...questions.flatMap((question) => referenceIds(question.acsCodes)),
    ...glossary.flatMap((term) => referenceIds(term.acsCodes)),
  ])
  const acsDocuments = await client.fetch<UnknownDocument[]>(`*[_id in $ids]`, {ids: acsIds})
  const acsIndex = indexDocuments(acsDocuments)

  const figureIds = uniqueStrings(
    questions
      .filter((question) => question.questionType === 'image')
      .map((question) =>
        referenceId(
          record(question.imageAnswer, `image answer for ${question._id}`).stimulusFigure,
          `stimulus figure for ${question._id}`,
        ),
      ),
  )
  const figures = await client.fetch<UnknownDocument[]>(
    `*[_id in $ids]{..., image{..., asset->{_id, url}}}`,
    {ids: figureIds},
  )
  const figureIndex = indexDocuments(figures)

  const convertQuestion = (referenceValue: unknown) =>
    questionFromDocument(
      dereference(questionIndex, referenceValue, 'question'),
      acsIndex,
      figureIndex,
    )

  const canonicalSections = dereferenceMany(
    sectionIndex,
    moduleDocument.sections,
    'module section',
  ).map((sectionDocument) => ({
    id: stringValue(sectionDocument.stableId, `stable ID for ${sectionDocument._id}`),
    title: stringValue(sectionDocument.title, `title for ${sectionDocument._id}`),
    order: numberValue(sectionDocument.order, `order for ${sectionDocument._id}`),
    summary: portableTextToPlain(sectionDocument.summary),
    sourcePages: stringValue(sectionDocument.sourcePages, `source pages for ${sectionDocument._id}`),
    acsCodes: acsCodesFor(sectionDocument, acsIndex),
    lessons: dereferenceMany(lessonIndex, sectionDocument.lessons, 'section lesson').map(
      (lessonDocument) => ({
        id: stringValue(lessonDocument.stableId, `stable ID for ${lessonDocument._id}`),
        title: stringValue(lessonDocument.title, `title for ${lessonDocument._id}`),
        order: numberValue(lessonDocument.order, `order for ${lessonDocument._id}`),
        estimatedMinutes: numberValue(
          lessonDocument.estimatedMinutes,
          `estimated minutes for ${lessonDocument._id}`,
        ),
        concept: blockText(lessonDocument, 'concept'),
        explanation: blockText(lessonDocument, 'explanation'),
        workedExample: blockText(lessonDocument, 'workedExample'),
        sourceCitation: firstCitation(lessonDocument),
        acsCodes: acsCodesFor(lessonDocument, acsIndex),
        practice: convertQuestion(arrayValue(lessonDocument.reviewQuestions)[0]),
      }),
    ),
    quiz: arrayValue(sectionDocument.quizQuestions).map(convertQuestion),
  }))

  const canonicalGlossary = dereferenceMany(
    glossaryIndex,
    moduleDocument.glossaryTerms,
    'glossary term',
  ).map((termDocument) => {
    const sectionDocument = dereference(
      sectionIndex,
      arrayValue(termDocument.sections)[0],
      `section for glossary term ${termDocument._id}`,
    )
    return {
      id: stringValue(termDocument.stableId, `stable ID for ${termDocument._id}`),
      term: stringValue(termDocument.term, `term for ${termDocument._id}`),
      definition: portableTextToPlain(termDocument.definition),
      sectionId: stringValue(sectionDocument.stableId, `section stable ID for ${termDocument._id}`),
      sourceCitation: firstCitation(termDocument),
      acsCodes: acsCodesFor(termDocument, acsIndex),
    }
  })

  const moduleCitation = firstCitation(moduleDocument)
  const module: ModuleContent = {
    id: stringValue(moduleDocument.stableId, 'module stable ID'),
    title: stringValue(moduleDocument.title, 'module title'),
    shortTitle:
      typeof moduleDocument.subtitle === 'string' && moduleDocument.subtitle
        ? moduleDocument.subtitle
        : stringValue(moduleDocument.title, 'module title'),
    description: portableTextToPlain(moduleDocument.description),
    version: stringValue(moduleDocument.contentVersion, 'module content version'),
    source: {
      title: moduleCitation.handbook,
      url: stringValue(moduleDocument.sourcePdfUrl, 'module source PDF URL'),
      edition: stringValue(moduleDocument.edition, 'module source edition'),
      checksum: stringValue(moduleDocument.sourceChecksum, 'module source checksum'),
    },
    sections: canonicalSections,
    exam: arrayValue(moduleDocument.finalExamQuestions).map(convertQuestion),
    glossary: canonicalGlossary,
  }

  const validatedModule = moduleContentSchema.parse(module)
  const bundleRaw = canonicalJson(validatedModule)
  const checksum = sha256(bundleRaw)
  const release = await client.fetch<Record<string, unknown> | null>(
    `*[
      _type == "contentRelease" &&
      status == "published" &&
      version == $version &&
      references($moduleDocumentId) &&
      !(_id in path("drafts.**"))
    ][0]{bundleUrl, bundleSha256, publishedAt}`,
    {version: validatedModule.version, moduleDocumentId: moduleDocument._id},
  )

  const releaseChecksum = typeof release?.bundleSha256 === 'string' ? release.bundleSha256 : undefined
  const releaseBundleUrl = typeof release?.bundleUrl === 'string' ? release.bundleUrl : undefined
  const bundleUrl =
    options.bundleUrl ?? (releaseChecksum === checksum ? releaseBundleUrl : undefined)
  if (!bundleUrl) {
    throw new Error(
      'The generated checksum differs from the published content release. Pass --bundle-url or set PREFLIGHT_CONTENT_BUNDLE_URL to the URL where this exact bundle will be published.',
    )
  }

  const createdAt =
    typeof release?.publishedAt === 'string' ? release.publishedAt : new Date().toISOString()
  const manifestRaw = canonicalJson({
    schemaVersion: 1,
    moduleId: validatedModule.id,
    contentVersion: validatedModule.version,
    bundleUrl,
    checksum,
    algorithm: 'sha256',
    byteLength: Buffer.byteLength(bundleRaw),
    createdAt,
  })

  await mkdir(options.outputDirectory, {recursive: true})
  const bundlePath = path.join(options.outputDirectory, 'phak.json')
  const manifestPath = path.join(options.outputDirectory, 'manifest.json')
  await atomicWrite(bundlePath, bundleRaw)
  await atomicWrite(manifestPath, manifestRaw)

  console.log(
    JSON.stringify(
      {
        mode: 'exported',
        moduleId: validatedModule.id,
        contentVersion: validatedModule.version,
        sections: validatedModule.sections.length,
        questions: questionIds.length,
        glossaryTerms: validatedModule.glossary.length,
        checksum,
        bundlePath,
        manifestPath,
      },
      null,
      2,
    ),
  )
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Content export failed: ${message}`)
  process.exitCode = 1
})
