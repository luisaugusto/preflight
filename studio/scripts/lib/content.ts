import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {z} from 'zod'

export const PROJECT_ID = process.env.SANITY_STUDIO_PROJECT_ID ?? '4qoowg94'
export const DATASET = process.env.SANITY_STUDIO_DATASET ?? 'production'
export const API_VERSION = '2026-07-12'

export const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const repositoryRoot = path.resolve(studioRoot, '..')
export const canonicalContentPath = path.join(repositoryRoot, 'src/content/phak.json')
export const figureAssetsPath = path.join(repositoryRoot, 'assets/phak')

const nonEmptyString = z.string().trim().min(1)
const contentId = nonEmptyString.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const sourceCitationSchema = z
  .object({
    handbook: nonEmptyString,
    edition: nonEmptyString,
    chapter: nonEmptyString,
    page: z.union([nonEmptyString, z.number().int().positive()]),
    url: z.string().url(),
    figure: nonEmptyString.optional(),
  })
  .strict()

const baseQuestionSchema = z.object({
  id: contentId,
  prompt: nonEmptyString,
  explanation: nonEmptyString,
  sourceCitation: sourceCitationSchema,
  acsCodes: z.array(nonEmptyString).min(1),
})

const multipleChoiceQuestionSchema = baseQuestionSchema
  .extend({
    type: z.literal('multipleChoice'),
    options: z.array(nonEmptyString).min(2).max(6),
    correctIndex: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((question, context) => {
    if (question.correctIndex >= question.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['correctIndex'],
        message: 'correctIndex must point to an answer option',
      })
    }
  })

const imageQuestionSchema = baseQuestionSchema
  .extend({
    type: z.literal('image'),
    image: z
      .object({
        uri: nonEmptyString,
        alt: nonEmptyString,
        caption: nonEmptyString,
        sourcePage: z.union([nonEmptyString, z.number().int().positive()]),
      })
      .strict(),
    options: z.array(nonEmptyString).min(2).max(6),
    correctIndex: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((question, context) => {
    if (question.correctIndex >= question.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['correctIndex'],
        message: 'correctIndex must point to an answer option',
      })
    }
  })

const numericQuestionSchema = baseQuestionSchema
  .extend({
    type: z.literal('numeric'),
    answer: z
      .object({
        value: z.number(),
        tolerance: z.number().nonnegative(),
        unit: nonEmptyString,
        acceptedFormats: z.array(nonEmptyString).optional(),
      })
      .strict(),
  })
  .strict()

const matchingQuestionSchema = baseQuestionSchema
  .extend({
    type: z.literal('matching'),
    pairs: z
      .array(
        z
          .object({
            id: contentId,
            left: nonEmptyString,
            right: nonEmptyString,
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict()

export const questionSchema = z.discriminatedUnion('type', [
  multipleChoiceQuestionSchema,
  imageQuestionSchema,
  numericQuestionSchema,
  matchingQuestionSchema,
])

export const moduleContentSchema = z
  .object({
    id: contentId,
    title: nonEmptyString,
    shortTitle: nonEmptyString,
    description: nonEmptyString,
    version: nonEmptyString,
    source: z
      .object({
        title: nonEmptyString,
        url: z.string().url(),
        edition: nonEmptyString,
        checksum: nonEmptyString,
      })
      .strict(),
    sections: z
      .array(
        z
          .object({
            id: contentId,
            title: nonEmptyString,
            order: z.number().int().positive(),
            summary: nonEmptyString,
            sourcePages: nonEmptyString,
            acsCodes: z.array(nonEmptyString).min(1),
            lessons: z
              .array(
                z
                  .object({
                    id: contentId,
                    title: nonEmptyString,
                    order: z.number().int().positive(),
                    estimatedMinutes: z.number().int().min(1).max(5),
                    concept: nonEmptyString,
                    explanation: nonEmptyString,
                    workedExample: nonEmptyString,
                    sourceCitation: sourceCitationSchema,
                    acsCodes: z.array(nonEmptyString).min(1),
                    practice: questionSchema,
                  })
                  .strict(),
              )
              .min(1),
            quiz: z.array(questionSchema).min(1),
          })
          .strict(),
      )
      .min(1),
    exam: z.array(questionSchema).min(1),
    glossary: z.array(
      z
        .object({
          id: contentId,
          term: nonEmptyString,
          definition: nonEmptyString,
          sectionId: contentId,
          sourceCitation: sourceCitationSchema,
          acsCodes: z.array(nonEmptyString).min(1),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((module, context) => {
    const ids = new Set<string>()
    const addId = (id: string, pathParts: (string | number)[]) => {
      if (ids.has(id)) {
        context.addIssue({code: 'custom', path: pathParts, message: `Duplicate content ID: ${id}`})
      }
      ids.add(id)
    }

    addId(module.id, ['id'])
    module.sections.forEach((section, sectionIndex) => {
      addId(section.id, ['sections', sectionIndex, 'id'])
      section.lessons.forEach((lesson, lessonIndex) =>
        addId(lesson.id, ['sections', sectionIndex, 'lessons', lessonIndex, 'id']),
      )
    })
    module.glossary.forEach((term, termIndex) =>
      addId(term.id, ['glossary', termIndex, 'id']),
    )

    const sectionIds = new Set(module.sections.map((section) => section.id))
    module.glossary.forEach((term, termIndex) => {
      if (!sectionIds.has(term.sectionId)) {
        context.addIssue({
          code: 'custom',
          path: ['glossary', termIndex, 'sectionId'],
          message: `Unknown section ID: ${term.sectionId}`,
        })
      }
    })
  })

export type SourceCitation = z.infer<typeof sourceCitationSchema>
export type CanonicalQuestion = z.infer<typeof questionSchema>
export type ModuleContent = z.infer<typeof moduleContentSchema>
export type CanonicalSection = ModuleContent['sections'][number]
export type CanonicalLesson = CanonicalSection['lessons'][number]

export async function loadCanonicalModule(): Promise<ModuleContent> {
  let raw: string
  try {
    raw = await readFile(canonicalContentPath, 'utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read ${canonicalContentPath}: ${message}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON in ${canonicalContentPath}: ${message}`)
  }

  return moduleContentSchema.parse(parsed)
}

export function normalizeId(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) throw new Error(`Cannot normalize an empty ID from ${JSON.stringify(value)}`)
  return normalized
}

export function documentId(type: string, stableId: string): string {
  return `${type}.${normalizeId(stableId)}`
}

export function reference(type: string, stableId: string, key?: string) {
  return {
    _type: 'reference' as const,
    _ref: documentId(type, stableId),
    ...(key ? {_key: key} : {}),
  }
}

export function keyFor(value: string, index = 0): string {
  return `${normalizeId(value).slice(0, 80)}-${index + 1}`
}

export function portableText(text: string, prefix = 'block') {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return paragraphs.map((paragraph, index) => ({
    _type: 'block',
    _key: keyFor(`${prefix}-${index}`, index),
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: keyFor(`${prefix}-span-${index}`, index),
        text: paragraph,
        marks: [],
      },
    ],
  }))
}

export function portableTextToPlain(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      const children = (block as {children?: unknown}).children
      if (!Array.isArray(children)) return ''
      return children
        .map((child) =>
          child && typeof child === 'object' && typeof (child as {text?: unknown}).text === 'string'
            ? (child as {text: string}).text
            : '',
        )
        .join('')
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

export function printedPageNumber(page: string | number): number {
  if (typeof page === 'number') return Math.max(1, Math.trunc(page))
  const numbers = page.match(/\d+/g)
  return numbers?.length ? Math.max(1, Number(numbers.at(-1))) : 1
}

export function toSanityCitation(citation: SourceCitation) {
  const chapterMatch = citation.chapter.match(/\d+/)
  return {
    _type: 'sourceCitation',
    publication: citation.handbook,
    documentCode: citation.edition,
    url: citation.url,
    ...(chapterMatch ? {chapterNumber: Number(chapterMatch[0])} : {}),
    chapterTitle: citation.chapter,
    pageNumber: printedPageNumber(citation.page),
    pageLabel: String(citation.page),
    ...(citation.figure ? {figureNumber: citation.figure} : {}),
    note: 'Imported from the canonical Preflight source citation.',
  }
}

export function fromSanityCitation(value: Record<string, unknown>): SourceCitation {
  const pageLabel = typeof value.pageLabel === 'string' && value.pageLabel ? value.pageLabel : value.pageNumber
  if (
    typeof value.publication !== 'string' ||
    typeof value.documentCode !== 'string' ||
    typeof value.url !== 'string' ||
    (typeof pageLabel !== 'string' && typeof pageLabel !== 'number')
  ) {
    throw new Error('A published document has an incomplete source citation.')
  }

  return {
    handbook: value.publication,
    edition: value.documentCode,
    chapter:
      typeof value.chapterTitle === 'string'
        ? value.chapterTitle
        : `Chapter ${typeof value.chapterNumber === 'number' ? value.chapterNumber : '?'}`,
    page: pageLabel,
    url: value.url,
    ...(typeof value.figureNumber === 'string' && value.figureNumber
      ? {figure: value.figureNumber}
      : {}),
  }
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for this operation.`)
  return value
}
