import {createReadStream} from 'node:fs'
import {mkdir, readdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createClient} from '@sanity/client'
import {getCliClient} from 'sanity/cli'

import {
  API_VERSION,
  DATASET,
  PROJECT_ID,
  canonicalJson,
  documentId,
  figureAssetsPath,
  keyFor,
  loadCanonicalModule,
  normalizeId,
  portableText,
  reference,
  sha256,
  toSanityCitation,
  unique,
  type CanonicalLesson,
  type CanonicalQuestion,
  type CanonicalSection,
  type ModuleContent,
  type SourceCitation,
} from './lib/content'

type SanitySeedDocument = {
  _id: string
  _type: string
  [key: string]: unknown
}

type QuestionUsage = 'practice' | 'sectionQuiz' | 'moduleExam' | 'dailyReview'

type QuestionRecord = {
  question: CanonicalQuestion
  section: CanonicalSection
  lessonIds: Set<string>
  usage: Set<QuestionUsage>
}

type FigureContext = {
  question?: Extract<CanonicalQuestion, {type: 'image'}>
  section: CanonicalSection
}

type UploadedAsset = {
  _id: string
  url?: string
}

type BuildOptions = {
  imageAssetIds: Map<string, string>
  bundleUrl: string
  bundleChecksum: string
  manifestUrl?: string
  publishedAt: string
}

const ACS_EDITION = 'FAA-S-ACS-6C'
const ACS_URL = 'https://www.faa.gov/training_testing/testing/acs/private_airplane_acs_6.pdf'
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const dryRun = process.argv.includes('--dry-run')
const publish = process.argv.includes('--publish') || process.env.PREFLIGHT_PUBLISH === 'true'
const ndjsonArgumentIndex = process.argv.indexOf('--ndjson')
const ndjsonPath =
  ndjsonArgumentIndex >= 0 && process.argv[ndjsonArgumentIndex + 1]
    ? path.resolve(process.argv[ndjsonArgumentIndex + 1])
    : undefined

function basenameFromUri(uri: string): string {
  const withoutQuery = uri.split(/[?#]/, 1)[0]
  return path.basename(withoutQuery)
}

function draftTimestamp(contentVersion: string): string {
  const match = contentVersion.match(/^(\d{4})\.(\d{2})\.(\d{2})/)
  if (!match) throw new Error(`Draft content version must start with YYYY.MM.DD: ${contentVersion}`)
  return `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`
}

function firstCitation(section: CanonicalSection): SourceCitation {
  return section.lessons[0]?.sourceCitation ?? section.quiz[0]?.sourceCitation
}

function withKey<T extends Record<string, unknown>>(value: T, key: string): T & {_key: string} {
  return {...value, _key: key}
}

function refs(type: string, ids: string[]) {
  return unique(ids).map((id, index) => reference(type, id, keyFor(`${type}-${id}`, index)))
}

function citations(values: SourceCitation[]) {
  const byFingerprint = new Map<string, SourceCitation>()
  values.forEach((citation) => byFingerprint.set(JSON.stringify(citation), citation))
  return [...byFingerprint.values()].map((citation, index) =>
    withKey(toSanityCitation(citation), keyFor(`citation-${index}`, index)),
  )
}

function canonicalAcsCode(input: string) {
  const match = input
    .trim()
    .match(/^([A-Z]{2})\.([IVXLCDM]+)\.([A-Z]+)\.([KRS])(\d+)([a-z]?)$/i)
  if (!match) throw new Error(`Unsupported Private Pilot ACS element code: ${input}`)
  const [, prefix, areaCode, taskCode, elementPrefix, elementNumber, suffix] = match
  const code = `${prefix.toUpperCase()}.${areaCode.toUpperCase()}.${taskCode.toUpperCase()}.${elementPrefix.toUpperCase()}${elementNumber}${suffix.toLowerCase()}`
  const elementType =
    elementPrefix.toUpperCase() === 'K'
      ? 'knowledge'
      : elementPrefix.toUpperCase() === 'R'
        ? 'riskManagement'
        : 'skill'
  return {code, areaCode: areaCode.toUpperCase(), taskCode: taskCode.toUpperCase(), elementType}
}

function acsStableId(code: string): string {
  return `acs-${normalizeId(canonicalAcsCode(code).code)}`
}

function figureStableId(filename: string): string {
  return `phak-${normalizeId(path.basename(filename, path.extname(filename)))}`
}

function chapterNumber(section: CanonicalSection): number {
  const match = firstCitation(section)?.chapter.match(/\d+/)
  return match ? Number(match[0]) : section.order
}

function collectQuestionRecords(module: ModuleContent): Map<string, QuestionRecord> {
  const records = new Map<string, QuestionRecord>()

  const register = (
    question: CanonicalQuestion,
    section: CanonicalSection,
    usage: QuestionUsage,
    lessonId?: string,
  ) => {
    const existing = records.get(question.id)
    if (existing && canonicalJson(existing.question) !== canonicalJson(question)) {
      throw new Error(`Question ${question.id} is reused with conflicting content.`)
    }
    const record = existing ?? {
      question,
      section,
      lessonIds: new Set<string>(),
      usage: new Set<QuestionUsage>(),
    }
    if (lessonId) record.lessonIds.add(lessonId)
    record.usage.add(usage)
    record.usage.add('dailyReview')
    records.set(question.id, record)
  }

  module.sections.forEach((section) => {
    section.lessons.forEach((lesson) => register(lesson.practice, section, 'practice', lesson.id))
    section.quiz.forEach((question) => register(question, section, 'sectionQuiz'))
  })

  module.exam.forEach((question) => {
    const citationChapter = question.sourceCitation.chapter.match(/\d+/)?.[0]
    const section =
      module.sections.find((candidate) => String(chapterNumber(candidate)) === citationChapter) ??
      module.sections.find((candidate) => candidate.acsCodes.some((code) => question.acsCodes.includes(code))) ??
      module.sections[0]
    register(question, section, 'moduleExam')
  })

  return records
}

function collectFigureContexts(
  module: ModuleContent,
  questionRecords: Map<string, QuestionRecord>,
): Map<string, FigureContext> {
  const contexts = new Map<string, FigureContext>()
  questionRecords.forEach(({question, section}) => {
    if (question.type === 'image') {
      contexts.set(basenameFromUri(question.image.uri), {question, section})
    }
  })
  module.sections.forEach((section) => {
    const prefix = `chapter-${String(chapterNumber(section)).padStart(2, '0')}-`
    const filename = [...contexts.keys()].find((candidate) => candidate.startsWith(prefix))
    if (filename && !contexts.get(filename)?.section) contexts.set(filename, {section})
  })
  return contexts
}

async function listFigureFiles(): Promise<string[]> {
  const entries = await readdir(figureAssetsPath, {withFileTypes: true})
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort()
}

function multipleChoiceSpec(
  options: string[],
  correctIndex: number,
  keyPrefix: string,
) {
  const optionIds = options.map((_option, index) => `option-${index + 1}`)
  return {
    _type: 'multipleChoiceAnswerSpec',
    options: options.map((text, index) => ({
      _type: 'answerOption',
      _key: keyFor(`${keyPrefix}-option`, index),
      optionId: optionIds[index],
      text,
    })),
    correctOptionId: optionIds[correctIndex],
    shuffleOptions: true,
  }
}

function questionDocument(module: ModuleContent, record: QuestionRecord): SanitySeedDocument {
  const {question, section, lessonIds, usage} = record
  const common: SanitySeedDocument = {
    _id: documentId('question', question.id),
    _type: 'question',
    stableId: question.id,
    title: question.prompt.slice(0, 137),
    prompt: portableText(question.prompt, `${question.id}-prompt`),
    questionType: question.type,
    difficulty: question.type === 'multipleChoice' ? 2 : 3,
    estimatedSeconds: question.type === 'matching' ? 90 : question.type === 'numeric' ? 120 : 60,
    explanation: portableText(question.explanation, `${question.id}-explanation`),
    module: reference('module', module.id),
    section: reference('section', section.id),
    ...(lessonIds.size ? {lessons: refs('lesson', [...lessonIds])} : {}),
    usage: [...usage],
    acsCodes: refs('acsCode', question.acsCodes.map(acsStableId)),
    tags: ['phak', question.type],
    active: true,
    citations: citations([question.sourceCitation]),
  }

  if (question.type === 'multipleChoice') {
    common.multipleChoiceAnswer = multipleChoiceSpec(
      question.options,
      question.correctIndex,
      question.id,
    )
  } else if (question.type === 'image') {
    common.imageAnswer = {
      _type: 'imageQuestionSpec',
      stimulusFigure: reference('figure', figureStableId(basenameFromUri(question.image.uri))),
      instruction: 'Use the referenced handbook figure to answer the question.',
      answer: multipleChoiceSpec(question.options, question.correctIndex, question.id),
    }
  } else if (question.type === 'numeric') {
    common.numericAnswer = {
      _type: 'numericAnswerSpec',
      value: question.answer.value,
      tolerance: question.answer.tolerance,
      unit: question.answer.unit,
      ...(question.answer.acceptedFormats?.length
        ? {
            acceptedFormats: question.answer.acceptedFormats,
          }
        : {}),
      decimalPlaces: Math.min(
        6,
        Math.max(0, String(question.answer.value).split('.')[1]?.length ?? 0),
      ),
    }
  } else {
    common.matchingAnswer = {
      _type: 'matchingAnswerSpec',
      pairs: question.pairs.map((pair, index) => ({
        _type: 'matchingPair',
        _key: keyFor(`${question.id}-pair`, index),
        pairId: pair.id,
        left: {label: pair.left},
        right: {label: pair.right},
      })),
      shuffleRightColumn: true,
    }
  }

  return common
}

function lessonDocument(
  lesson: CanonicalLesson,
  section: CanonicalSection,
  glossaryIds: string[],
): SanitySeedDocument {
  const citation = toSanityCitation(lesson.sourceCitation)
  const lessonBlock = (blockType: string, heading: string, text: string, index: number) => ({
    _type: 'lessonBlock',
    _key: keyFor(`${lesson.id}-${blockType}`, index),
    blockType,
    heading,
    body: portableText(text, `${lesson.id}-${blockType}`),
    citations: [withKey(citation, keyFor(`${lesson.id}-${blockType}-citation`))],
  })

  return {
    _id: documentId('lesson', lesson.id),
    _type: 'lesson',
    stableId: lesson.id,
    section: reference('section', section.id),
    title: lesson.title,
    slug: {_type: 'slug', current: normalizeId(lesson.title)},
    order: lesson.order,
    estimatedMinutes: lesson.estimatedMinutes,
    isRequired: true,
    learningObjectives: [`Explain ${lesson.title}.`],
    content: [
      lessonBlock('concept', 'Concept', lesson.concept, 0),
      lessonBlock('explanation', 'Explanation', lesson.explanation, 1),
      lessonBlock('workedExample', 'Worked example', lesson.workedExample, 2),
      {
        ...lessonBlock('practice', 'Check your understanding', 'Apply this concept before continuing.', 3),
        practiceQuestion: reference('question', lesson.practice.id),
      },
    ],
    reviewQuestions: refs('question', [lesson.practice.id]),
    ...(glossaryIds.length ? {glossaryTerms: refs('glossaryTerm', glossaryIds)} : {}),
    acsCodes: refs('acsCode', lesson.acsCodes.map(acsStableId)),
    citations: citations([lesson.sourceCitation]),
  }
}

function buildDocuments(
  module: ModuleContent,
  figureFiles: string[],
  questionRecords: Map<string, QuestionRecord>,
  figureContexts: Map<string, FigureContext>,
  options: BuildOptions,
): SanitySeedDocument[] {
  const sortedSections = [...module.sections].sort((left, right) => left.order - right.order)
  const glossaryBySection = new Map<string, string[]>()
  module.glossary.forEach((term) => {
    glossaryBySection.set(term.sectionId, [...(glossaryBySection.get(term.sectionId) ?? []), term.id])
  })

  const allAcsCodes = unique([
    ...sortedSections.flatMap((section) => section.acsCodes),
    ...sortedSections.flatMap((section) => section.lessons.flatMap((lesson) => lesson.acsCodes)),
    ...[...questionRecords.values()].flatMap(({question}) => question.acsCodes),
    ...module.glossary.flatMap((term) => term.acsCodes),
  ])

  const acsDocuments = allAcsCodes.map((inputCode) => {
    const parsed = canonicalAcsCode(inputCode)
    const matchingSection =
      sortedSections.find((section) => section.acsCodes.includes(inputCode)) ?? sortedSections[0]
    return {
      _id: documentId('acsCode', acsStableId(inputCode)),
      _type: 'acsCode',
      stableId: acsStableId(inputCode),
      code: parsed.code,
      elementType: parsed.elementType,
      description: `Preflight content aligned to ${parsed.code} in ${matchingSection.title}.`,
      areaCode: parsed.areaCode,
      areaTitle: `Area ${parsed.areaCode}`,
      taskCode: parsed.taskCode,
      taskTitle: `Task ${parsed.taskCode}`,
      acsVersion: ACS_EDITION,
      citation: {
        _type: 'sourceCitation',
        publication: 'Private Pilot for Airplane Category Airman Certification Standards',
        documentCode: ACS_EDITION,
        url: ACS_URL,
        pageNumber: 1,
        pageLabel: parsed.code,
        note: `Controlled ACS vocabulary entry for ${parsed.code}.`,
      },
    }
  })

  const figureDocuments = figureFiles.map((filename) => {
    const context = figureContexts.get(filename)
    const chapterMatch = filename.match(/^chapter-(\d+)-/)
    const fallbackSection =
      sortedSections.find((section) => section.order === Number(chapterMatch?.[1])) ?? sortedSections[0]
    const section = context?.section ?? fallbackSection
    const question = context?.question
    const sourceCitation = question
      ? {...question.sourceCitation, page: question.image.sourcePage}
      : firstCitation(section)
    const assetId = options.imageAssetIds.get(filename)
    if (!assetId) throw new Error(`No Sanity image asset mapping exists for ${filename}.`)

    return {
      _id: documentId('figure', figureStableId(filename)),
      _type: 'figure',
      stableId: figureStableId(filename),
      title: question?.image.caption ?? `${section.title} representative figure`,
      image: {
        _type: 'image',
        asset: {_type: 'reference', _ref: assetId},
        alt: question?.image.alt ?? `Representative handbook figure for ${section.title}.`,
      },
      caption: question?.image.caption ?? `Representative handbook figure for ${section.title}.`,
      ...(sourceCitation.figure ? {figureNumber: sourceCitation.figure} : {}),
      extractionMethod: 'pageCrop',
      originalFilename: filename,
      citation: toSanityCitation(sourceCitation),
      sections: refs('section', [section.id]),
      acsCodes: refs('acsCode', (question?.acsCodes ?? section.acsCodes).map(acsStableId)),
      tags: ['phak', 'representative-figure'],
    }
  })

  const questionDocuments = [...questionRecords.values()].map((record) =>
    questionDocument(module, record),
  )

  const lessonDocuments = sortedSections.flatMap((section) =>
    [...section.lessons]
      .sort((left, right) => left.order - right.order)
      .map((lesson) => lessonDocument(lesson, section, glossaryBySection.get(section.id) ?? [])),
  )

  const sectionDocuments = sortedSections.map((section) => {
    const lessons = [...section.lessons].sort((left, right) => left.order - right.order)
    const sectionFigure = figureFiles.find((filename) =>
      filename.startsWith(`chapter-${String(chapterNumber(section)).padStart(2, '0')}-`),
    )
    const sectionCitations = citations([
      ...lessons.map((lesson) => lesson.sourceCitation),
      ...section.quiz.map((question) => question.sourceCitation),
    ])
    return {
      _id: documentId('section', section.id),
      _type: 'section',
      stableId: section.id,
      module: reference('module', module.id),
      title: section.title,
      slug: {_type: 'slug', current: normalizeId(section.title)},
      order: section.order,
      chapterNumber: chapterNumber(section),
      chapterTitle: firstCitation(section).chapter,
      sourcePages: section.sourcePages,
      summary: portableText(section.summary, `${section.id}-summary`),
      learningObjectives: lessons.map((lesson) => `Explain ${lesson.title}.`),
      ...(sectionFigure ? {heroFigure: reference('figure', figureStableId(sectionFigure))} : {}),
      lessons: refs('lesson', lessons.map((lesson) => lesson.id)),
      quizQuestions: refs('question', section.quiz.map((question) => question.id)),
      ...(glossaryBySection.get(section.id)?.length
        ? {glossaryTerms: refs('glossaryTerm', glossaryBySection.get(section.id) ?? [])}
        : {}),
      acsCodes: refs('acsCode', section.acsCodes.map(acsStableId)),
      estimatedMinutes:
        lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0) +
        Math.max(1, Math.ceil(section.quiz.length / 2)),
      passingScore: 80,
      citations: sectionCitations,
    }
  })

  const glossaryDocuments = module.glossary.map((term) => ({
    _id: documentId('glossaryTerm', term.id),
    _type: 'glossaryTerm',
    stableId: term.id,
    term: term.term,
    slug: {_type: 'slug', current: normalizeId(`${term.term}-${term.id}`)},
    shortDefinition: term.definition.slice(0, 300),
    definition: portableText(term.definition, `${term.id}-definition`),
    sections: refs('section', [term.sectionId]),
    acsCodes: refs('acsCode', term.acsCodes.map(acsStableId)),
    citations: citations([term.sourceCitation]),
  }))

  const representativeFigure = figureFiles[0]
  const moduleCitations = citations(sortedSections.map(firstCitation))
  const moduleDocument: SanitySeedDocument = {
    _id: documentId('module', module.id),
    _type: 'module',
    stableId: module.id,
    title: module.title,
    slug: {_type: 'slug', current: normalizeId(module.title)},
    subtitle: module.shortTitle,
    description: portableText(module.description, `${module.id}-description`),
    ...(representativeFigure
      ? {coverFigure: reference('figure', figureStableId(representativeFigure))}
      : {}),
    sections: refs('section', sortedSections.map((section) => section.id)),
    finalExamQuestions: refs('question', module.exam.map((question) => question.id)),
    glossaryTerms: refs('glossaryTerm', module.glossary.map((term) => term.id)),
    acsCodes: refs('acsCode', allAcsCodes.map(acsStableId)),
    passingScore: 80,
    estimatedMinutes: sectionDocuments.reduce(
      (total, section) => total + Number(section.estimatedMinutes),
      0,
    ),
    status: 'published',
    contentVersion: module.version,
    publishedAt: options.publishedAt,
    disclaimer:
      'Preflight is an unofficial study aid. It is not approved or endorsed by the FAA and has not been reviewed by a certified flight instructor. Always consult current FAA publications and your flight instructor.',
    documentCode: module.source.edition,
    edition: module.source.edition,
    sourcePdfUrl: module.source.url,
    sourceChecksum: module.source.checksum,
    citations: moduleCitations,
  }

  const releaseStableId = `content-${normalizeId(module.version)}`
  const releaseDocument: SanitySeedDocument = {
    _id: documentId('contentRelease', releaseStableId),
    _type: 'contentRelease',
    stableId: releaseStableId,
    title: `${module.shortTitle} ${module.version}`,
    version: module.version,
    status: 'published',
    modules: refs('module', [module.id]),
    releaseNotes: portableText(
      `Initial generated ${module.shortTitle} content release for ${module.source.edition}.`,
      `${releaseStableId}-notes`,
    ),
    publishedAt: options.publishedAt,
    schemaVersion: 1,
    minimumAppVersion: process.env.PREFLIGHT_MINIMUM_APP_VERSION ?? '0.1.0',
    bundleUrl: options.bundleUrl,
    bundleSha256: options.bundleChecksum,
    ...(options.manifestUrl ? {assetManifestUrl: options.manifestUrl} : {}),
  }

  return [
    ...acsDocuments,
    ...figureDocuments,
    ...questionDocuments,
    ...lessonDocuments,
    ...sectionDocuments,
    ...glossaryDocuments,
    moduleDocument,
    releaseDocument,
  ]
}

function prepareSeedDocuments(documents: SanitySeedDocument[]): SanitySeedDocument[] {
  if (publish) return documents
  return documents.map((document) => {
    const prepared = weakenDraftReferences({
      ...document,
      _id: `drafts.${document._id}`,
    }) as SanitySeedDocument
    if (document._type === 'module' || document._type === 'contentRelease') {
      prepared.status = 'draft'
      delete prepared.publishedAt
    }
    return prepared
  })
}

function weakenDraftReferences(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(weakenDraftReferences)
  if (!value || typeof value !== 'object') return value

  const record = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      weakenDraftReferences(item),
    ]),
  )
  if (
    record._type === 'reference' &&
    typeof record._ref === 'string' &&
    !record._ref.startsWith('image-') &&
    !record._ref.startsWith('file-')
  ) {
    record._weak = true
  }
  return record
}

function validateDocuments(documents: SanitySeedDocument[]) {
  const ids = new Set<string>()
  for (const document of documents) {
    if (ids.has(document._id)) throw new Error(`Duplicate Sanity document ID: ${document._id}`)
    ids.add(document._id)
    if (publish === document._id.startsWith('drafts.')) {
      throw new Error(`Unexpected document ID for ${publish ? 'publish' : 'draft'} mode: ${document._id}`)
    }
  }
}

async function uploadImages(
  client: ReturnType<typeof createClient>,
  figureFiles: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  for (const filename of figureFiles) {
    const extension = path.extname(filename).toLowerCase()
    const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
    const asset = (await client.assets.upload(
      'image',
      createReadStream(path.join(figureAssetsPath, filename)),
      {filename, contentType},
    )) as UploadedAsset
    result.set(filename, asset._id)
    console.log(`Uploaded image asset: ${filename}`)
  }
  return result
}

async function uploadJsonFile(
  client: ReturnType<typeof createClient>,
  filename: string,
  raw: string,
): Promise<UploadedAsset> {
  return (await client.assets.upload('file', Buffer.from(raw), {
    filename,
    contentType: 'application/json',
  })) as UploadedAsset
}

async function writeDocuments(
  client: ReturnType<typeof createClient>,
  documents: SanitySeedDocument[],
) {
  const chunkSize = 50
  for (let offset = 0; offset < documents.length; offset += chunkSize) {
    const chunk = documents.slice(offset, offset + chunkSize)
    let transaction = client.transaction()
    chunk.forEach((document) => {
      transaction = transaction.createOrReplace(document)
    })
    await transaction.commit({visibility: 'sync'})
    console.log(`${publish ? 'Published' : 'Seeded draft'} documents ${offset + 1}–${offset + chunk.length} of ${documents.length}`)
  }
}

async function main() {
  const module = await loadCanonicalModule()
  const figureFiles = await listFigureFiles()
  if (!figureFiles.length) throw new Error(`No representative figures found in ${figureAssetsPath}.`)

  const questionRecords = collectQuestionRecords(module)
  const figureContexts = collectFigureContexts(module, questionRecords)
  for (const {question} of figureContexts.values()) {
    if (question && !figureFiles.includes(basenameFromUri(question.image.uri))) {
      throw new Error(`Image question ${question.id} references a missing asset: ${question.image.uri}`)
    }
  }

  const bundleRaw = canonicalJson(module)
  const bundleChecksum = sha256(bundleRaw)
  const placeholderAssetIds = new Map(
    figureFiles.map((filename) => [filename, `image-placeholder-${sha256(filename).slice(0, 40)}-1x1-jpg`]),
  )
  const now = new Date().toISOString()
  const defaultContentTimestamp = publish ? now : draftTimestamp(module.version)
  const dryRunDocuments = prepareSeedDocuments(buildDocuments(module, figureFiles, questionRecords, figureContexts, {
    imageAssetIds: placeholderAssetIds,
    bundleUrl: `https://example.invalid/preflight/${module.version}/phak.json`,
    bundleChecksum,
    manifestUrl: `https://example.invalid/preflight/${module.version}/manifest.json`,
    publishedAt: defaultContentTimestamp,
  }))
  validateDocuments(dryRunDocuments)

  const counts = Object.fromEntries(
    [...new Set(dryRunDocuments.map((document) => document._type))].map((type) => [
      type,
      dryRunDocuments.filter((document) => document._type === type).length,
    ]),
  )

  if (ndjsonPath) {
    await mkdir(path.dirname(ndjsonPath), {recursive: true})
    await writeFile(
      ndjsonPath,
      `${dryRunDocuments.map((document) => JSON.stringify(document)).join('\n')}\n`,
      'utf8',
    )
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          documentMode: publish ? 'published' : 'drafts',
          source: 'src/content/phak.json',
          moduleId: module.id,
          contentVersion: module.version,
          figures: figureFiles.length,
          documents: dryRunDocuments.length,
          counts,
          bundleChecksum,
          ...(ndjsonPath ? {ndjsonPath} : {}),
          mutations: 0,
        },
        null,
        2,
      ),
    )
    return
  }

  const token = process.env.SANITY_AUTH_TOKEN
  const client = token
    ? createClient({
        projectId: PROJECT_ID,
        dataset: DATASET,
        apiVersion: API_VERSION,
        token,
        useCdn: false,
        perspective: 'published',
      })
    : getCliClient({apiVersion: API_VERSION})

  const existing = await client.fetch<Array<{_id: string; publishedAt?: string}>>(
    `*[_id in $ids]{_id, publishedAt}`,
    {
      ids: [
        documentId('module', module.id),
        documentId('contentRelease', `content-${normalizeId(module.version)}`),
      ],
    },
  )
  const publishedAt =
    existing.find((document) => document.publishedAt)?.publishedAt ?? defaultContentTimestamp

  const imageAssetIds = await uploadImages(client, figureFiles)
  const bundleAsset = await uploadJsonFile(client, `phak-${module.version}.json`, bundleRaw)
  if (!bundleAsset.url) throw new Error('Sanity did not return a CDN URL for the content bundle asset.')
  const manifestRaw = canonicalJson({
    schemaVersion: 1,
    moduleId: module.id,
    contentVersion: module.version,
    bundleUrl: bundleAsset.url,
    checksum: bundleChecksum,
    algorithm: 'sha256',
    byteLength: Buffer.byteLength(bundleRaw),
    createdAt: publishedAt,
  })
  const manifestAsset = await uploadJsonFile(client, `phak-${module.version}-manifest.json`, manifestRaw)
  if (!manifestAsset.url) throw new Error('Sanity did not return a CDN URL for the content manifest asset.')

  const documents = prepareSeedDocuments(buildDocuments(module, figureFiles, questionRecords, figureContexts, {
    imageAssetIds,
    bundleUrl: bundleAsset.url,
    bundleChecksum,
    manifestUrl: manifestAsset.url,
    publishedAt,
  }))
  validateDocuments(documents)
  await writeDocuments(client, documents)

  console.log(
    JSON.stringify(
      {
        mode: publish ? 'published' : 'seeded-drafts',
        projectId: PROJECT_ID,
        dataset: DATASET,
        moduleId: module.id,
        contentVersion: module.version,
        figures: figureFiles.length,
        documents: documents.length,
        counts,
        bundleChecksum,
        bundleUrl: bundleAsset.url,
        manifestUrl: manifestAsset.url,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`PHAK seed failed: ${message}`)
  process.exitCode = 1
})
