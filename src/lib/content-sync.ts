import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { z } from 'zod';

import type { ContentBundle, ModuleContent, Question, SourceCitation } from './content/types';

const nonEmptyString = z.string().trim().min(1);
const contentIdSchema = nonEmptyString.max(200);
const acsCodesSchema = z.array(nonEmptyString).min(1);

export const sourceCitationSchema: z.ZodType<SourceCitation> = z
  .object({
    handbook: nonEmptyString,
    edition: nonEmptyString,
    chapter: nonEmptyString,
    page: z.union([nonEmptyString, z.number().finite()]),
    url: z.string().url(),
    figure: nonEmptyString.optional(),
  })
  .strict();

const questionBaseShape = {
  id: contentIdSchema,
  prompt: nonEmptyString,
  explanation: nonEmptyString,
  sourceCitation: sourceCitationSchema,
  acsCodes: acsCodesSchema,
};

const multipleChoiceQuestionSchema = z
  .object({
    ...questionBaseShape,
    type: z.literal('multipleChoice'),
    options: z.array(nonEmptyString).min(2),
    correctIndex: z.number().int().nonnegative(),
  })
  .strict();

const imageQuestionSchema = z
  .object({
    ...questionBaseShape,
    type: z.literal('image'),
    image: z
      .object({
        uri: nonEmptyString,
        alt: nonEmptyString,
        caption: nonEmptyString,
        sourcePage: z.union([nonEmptyString, z.number().finite()]),
      })
      .strict(),
    options: z.array(nonEmptyString).min(2),
    correctIndex: z.number().int().nonnegative(),
  })
  .strict();

const numericQuestionSchema = z
  .object({
    ...questionBaseShape,
    type: z.literal('numeric'),
    answer: z
      .object({
        value: z.number().finite(),
        tolerance: z.number().finite().nonnegative(),
        unit: z.string().trim(),
        acceptedFormats: z.array(nonEmptyString).optional(),
      })
      .strict(),
  })
  .strict();

const matchingQuestionSchema = z
  .object({
    ...questionBaseShape,
    type: z.literal('matching'),
    pairs: z
      .array(
        z
          .object({
            id: contentIdSchema,
            left: nonEmptyString,
            right: nonEmptyString,
          })
          .strict(),
      )
      .min(2),
  })
  .strict();

export const questionSchema: z.ZodType<Question> = z
  .discriminatedUnion('type', [
    multipleChoiceQuestionSchema,
    numericQuestionSchema,
    matchingQuestionSchema,
    imageQuestionSchema,
  ])
  .superRefine((question, context) => {
    if (
      (question.type === 'multipleChoice' || question.type === 'image') &&
      question.correctIndex >= question.options.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['correctIndex'],
        message: 'correctIndex must refer to an option',
      });
    }
    if (question.type === 'matching') {
      const ids = new Set<string>();
      const leftValues = new Set<string>();
      question.pairs.forEach((pair, index) => {
        if (ids.has(pair.id)) {
          context.addIssue({
            code: 'custom',
            path: ['pairs', index, 'id'],
            message: 'Duplicate pair id',
          });
        }
        if (leftValues.has(pair.left)) {
          context.addIssue({
            code: 'custom',
            path: ['pairs', index, 'left'],
            message: 'Duplicate left value',
          });
        }
        ids.add(pair.id);
        leftValues.add(pair.left);
      });
    }
  });

const lessonSchema = z
  .object({
    id: contentIdSchema,
    title: nonEmptyString,
    order: z.number().int().nonnegative(),
    estimatedMinutes: z.number().positive().max(5),
    concept: nonEmptyString,
    explanation: nonEmptyString,
    workedExample: nonEmptyString,
    sourceCitation: sourceCitationSchema,
    acsCodes: acsCodesSchema,
    practice: questionSchema,
  })
  .strict();

const sectionSchema = z
  .object({
    id: contentIdSchema,
    title: nonEmptyString,
    order: z.number().int().nonnegative(),
    summary: nonEmptyString,
    sourcePages: nonEmptyString,
    acsCodes: acsCodesSchema,
    lessons: z.array(lessonSchema).min(1),
    quiz: z.array(questionSchema).min(1),
  })
  .strict();

const glossaryTermSchema = z
  .object({
    id: contentIdSchema,
    term: nonEmptyString,
    definition: nonEmptyString,
    sectionId: contentIdSchema,
    sourceCitation: sourceCitationSchema,
    acsCodes: acsCodesSchema,
  })
  .strict();

export const moduleContentSchema: z.ZodType<ModuleContent> = z
  .object({
    id: contentIdSchema,
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
    sections: z.array(sectionSchema).min(1),
    exam: z.array(questionSchema).min(1),
    glossary: z.array(glossaryTermSchema).min(1),
  })
  .strict()
  .superRefine((module, context) => {
    const entityIds = new Map<string, string>();
    const questionIds = new Set<string>();
    const sectionIds = new Set(module.sections.map((section) => section.id));

    const checkEntityId = (id: string, path: (string | number)[], kind: string) => {
      const existing = entityIds.get(id);
      if (existing) {
        context.addIssue({
          code: 'custom',
          path,
          message: `Duplicate content id; already used by ${existing}`,
        });
      } else {
        entityIds.set(id, kind);
      }
    };
    const checkQuestion = (question: Question, path: (string | number)[]) => {
      checkEntityId(question.id, [...path, 'id'], 'question');
      if (questionIds.has(question.id)) {
        context.addIssue({
          code: 'custom',
          path: [...path, 'id'],
          message: 'Duplicate question id',
        });
      }
      questionIds.add(question.id);
    };

    checkEntityId(module.id, ['id'], 'module');
    const orders = new Set<number>();
    module.sections.forEach((section, sectionIndex) => {
      checkEntityId(section.id, ['sections', sectionIndex, 'id'], 'section');
      if (orders.has(section.order)) {
        context.addIssue({
          code: 'custom',
          path: ['sections', sectionIndex, 'order'],
          message: 'Section order values must be unique',
        });
      }
      orders.add(section.order);

      const lessonOrders = new Set<number>();
      section.lessons.forEach((lesson, lessonIndex) => {
        checkEntityId(
          lesson.id,
          ['sections', sectionIndex, 'lessons', lessonIndex, 'id'],
          'lesson',
        );
        if (lessonOrders.has(lesson.order)) {
          context.addIssue({
            code: 'custom',
            path: ['sections', sectionIndex, 'lessons', lessonIndex, 'order'],
            message: 'Lesson order values must be unique within a section',
          });
        }
        lessonOrders.add(lesson.order);
        checkQuestion(lesson.practice, [
          'sections',
          sectionIndex,
          'lessons',
          lessonIndex,
          'practice',
        ]);
      });
      section.quiz.forEach((question, questionIndex) =>
        checkQuestion(question, ['sections', sectionIndex, 'quiz', questionIndex]),
      );
    });
    module.exam.forEach((question, questionIndex) =>
      checkQuestion(question, ['exam', questionIndex]),
    );
    module.glossary.forEach((term, termIndex) => {
      checkEntityId(term.id, ['glossary', termIndex, 'id'], 'glossary term');
      if (!sectionIds.has(term.sectionId)) {
        context.addIssue({
          code: 'custom',
          path: ['glossary', termIndex, 'sectionId'],
          message: 'Glossary sectionId must refer to a section in this module',
        });
      }
    });
  });

export const contentBundleSchema: z.ZodType<ContentBundle> = z
  .object({
    schemaVersion: z.number().int().positive(),
    contentVersion: nonEmptyString,
    generatedAt: z.string().datetime({ offset: true }).optional(),
    module: moduleContentSchema,
  })
  .strict()
  .superRefine((bundle, context) => {
    if (bundle.contentVersion !== bundle.module.version) {
      context.addIssue({
        code: 'custom',
        path: ['contentVersion'],
        message: 'contentVersion must match module.version',
      });
    }
  });

export function normalizeContent(input: unknown): ModuleContent {
  const direct = moduleContentSchema.safeParse(input);
  if (direct.success) return direct.data;

  const bundle = contentBundleSchema.safeParse(input);
  if (bundle.success) return bundle.data.module;

  if (input && typeof input === 'object' && 'module' in input) {
    return moduleContentSchema.parse((input as { module: unknown }).module);
  }
  if (input && typeof input === 'object' && 'modules' in input) {
    const modules = (input as { modules: unknown }).modules;
    if (Array.isArray(modules) && modules.length === 1)
      return moduleContentSchema.parse(modules[0]);
  }

  // Return the most relevant canonical error to make bad generated content easy to diagnose.
  return moduleContentSchema.parse(input);
}

export function parseModuleContent(input: unknown): ModuleContent {
  return normalizeContent(input);
}

export function safeParseModuleContent(
  input: unknown,
): { success: true; data: ModuleContent } | { success: false; error: z.ZodError } {
  try {
    return { success: true, data: normalizeContent(input) };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error };
    throw error;
  }
}

export interface ContentManifest {
  schemaVersion: number;
  moduleId: string;
  contentVersion: string;
  bundleUrl: string;
  checksum: string;
  algorithm: 'sha256';
  byteLength?: number;
  createdAt: string;
}

export const contentManifestSchema: z.ZodType<ContentManifest> = z
  .object({
    schemaVersion: z.number().int().positive(),
    moduleId: contentIdSchema,
    contentVersion: nonEmptyString,
    bundleUrl: z.string().url(),
    checksum: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Expected a SHA-256 checksum'),
    algorithm: z.literal('sha256'),
    byteLength: z.number().int().positive().optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export interface StoredContent {
  manifest: ContentManifest;
  raw: string;
  module: ModuleContent;
}

export interface ContentStore {
  readActive(): Promise<StoredContent | null>;
  stage(candidate: StoredContent): Promise<void>;
  activate(): Promise<void>;
  rollback(): Promise<void>;
  clearStaged(): Promise<void>;
}

export type ContentUpdateStatus = 'updated' | 'upToDate' | 'rolledBack' | 'failed';

export interface ContentUpdateResult {
  status: ContentUpdateStatus;
  active: StoredContent | null;
  previousVersion?: string;
  error?: string;
}

export interface ContentUpdateDependencies {
  store: ContentStore;
  downloadText?: (url: string) => Promise<string>;
  hash?: (raw: string) => Promise<string>;
  force?: boolean;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export async function sha256(raw: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, raw);
}

export async function validateContentPayload(
  raw: string,
  manifestInput: unknown,
  hash: (rawValue: string) => Promise<string> = sha256,
): Promise<StoredContent> {
  const manifest = contentManifestSchema.parse(manifestInput);
  if (manifest.byteLength !== undefined && utf8ByteLength(raw) !== manifest.byteLength) {
    throw new Error('Downloaded content byte length does not match the manifest');
  }
  const actualChecksum = (await hash(raw)).toLowerCase();
  if (actualChecksum !== manifest.checksum.toLowerCase()) {
    throw new Error('Downloaded content checksum does not match the manifest');
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('Downloaded content is not valid JSON');
  }
  const module = normalizeContent(json);
  if (module.id !== manifest.moduleId)
    throw new Error('Downloaded module id does not match the manifest');
  if (module.version !== manifest.contentVersion) {
    throw new Error('Downloaded content version does not match the manifest');
  }
  return { manifest, raw, module };
}

function versionParts(value: string): number[] | null {
  const normalized = value.trim().replace(/^v/i, '');
  if (!/^\d+(?:\.\d+)*$/.test(normalized)) return null;
  return normalized.split('.').map(Number);
}

export function compareContentVersions(left: string, right: string): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (leftParts && rightParts) {
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
      if (difference !== 0) return Math.sign(difference);
    }
    return 0;
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

async function defaultDownloadText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Content download failed with HTTP ${response.status}`);
  return response.text();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function updateContentFromManifest(
  manifestInput: unknown,
  dependencies: ContentUpdateDependencies,
): Promise<ContentUpdateResult> {
  let active: StoredContent | null;
  try {
    active = await dependencies.store.readActive();
  } catch (readError) {
    // A corrupt active slot should not prevent recovery from the known-good backup.
    await dependencies.store.rollback().catch(() => undefined);
    try {
      active = await dependencies.store.readActive();
    } catch {
      return {
        status: 'failed',
        active: null,
        error: `Unable to read active content: ${errorMessage(readError)}`,
      };
    }
  }
  const previousVersion = active?.manifest.contentVersion;
  let activationStarted = false;

  try {
    const manifest = contentManifestSchema.parse(manifestInput);
    if (!dependencies.force && active) {
      if (manifest.moduleId !== active.module.id) {
        throw new Error('Remote manifest module id does not match active content');
      }
      const sameRelease =
        active.manifest.checksum.toLowerCase() === manifest.checksum.toLowerCase() &&
        active.manifest.contentVersion === manifest.contentVersion;
      const isOlder =
        compareContentVersions(manifest.contentVersion, active.manifest.contentVersion) < 0;
      if (sameRelease || isOlder) {
        return { status: 'upToDate', active, previousVersion };
      }
    }

    const raw = await (dependencies.downloadText ?? defaultDownloadText)(manifest.bundleUrl);
    const candidate = await validateContentPayload(raw, manifest, dependencies.hash ?? sha256);
    await dependencies.store.stage(candidate);
    activationStarted = true;
    await dependencies.store.activate();
    active = await dependencies.store.readActive();
    if (!active || active.manifest.checksum.toLowerCase() !== manifest.checksum.toLowerCase()) {
      throw new Error('Content activation verification failed');
    }
    return { status: 'updated', active, previousVersion };
  } catch (error) {
    await dependencies.store.clearStaged().catch(() => undefined);
    if (activationStarted) {
      await dependencies.store.rollback().catch(() => undefined);
      active = await dependencies.store.readActive().catch(() => null);
      return {
        status: active ? 'rolledBack' : 'failed',
        active,
        previousVersion,
        error: errorMessage(error),
      };
    }
    return { status: 'failed', active, previousVersion, error: errorMessage(error) };
  }
}

export async function fetchContentManifest(url: string): Promise<ContentManifest> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Manifest download failed with HTTP ${response.status}`);
  return contentManifestSchema.parse(await response.json());
}

export async function syncContent(
  manifestUrl: string,
  dependencies: Omit<ContentUpdateDependencies, 'store'> & { store: ContentStore },
): Promise<ContentUpdateResult> {
  const manifest = await fetchContentManifest(manifestUrl);
  return updateContentFromManifest(manifest, dependencies);
}

/** In-memory implementation useful for tests and ephemeral previews. */
export class MemoryContentStore implements ContentStore {
  private active: StoredContent | null;
  private previous: StoredContent | null = null;
  private staged: StoredContent | null = null;
  failActivation = false;

  constructor(initial: StoredContent | null = null) {
    this.active = initial;
  }

  async readActive(): Promise<StoredContent | null> {
    return this.active;
  }

  async stage(candidate: StoredContent): Promise<void> {
    this.staged = candidate;
  }

  async activate(): Promise<void> {
    if (!this.staged) throw new Error('No content has been staged');
    this.previous = this.active;
    this.active = this.staged;
    this.staged = null;
    if (this.failActivation) throw new Error('Simulated content activation failure');
  }

  async rollback(): Promise<void> {
    this.active = this.previous;
    this.previous = null;
    this.staged = null;
  }

  async clearStaged(): Promise<void> {
    this.staged = null;
  }
}

interface StoredFileEnvelope {
  manifest: ContentManifest;
  raw: string;
}

/**
 * Atomic three-slot filesystem store: `staged` is verified before activation,
 * while `previous` remains available if replacing `active` fails.
 */
export class ExpoFileContentStore implements ContentStore {
  private readonly directory: Directory;

  constructor(directory: Directory = new Directory(Paths.document, 'preflight-content')) {
    this.directory = directory;
  }

  private ensureDirectory(): void {
    this.directory.create({ idempotent: true, intermediates: true });
  }

  private file(slot: 'active' | 'previous' | 'staged'): File {
    return new File(this.directory, `${slot}.json`);
  }

  private async readSlot(slot: 'active' | 'previous' | 'staged'): Promise<StoredContent | null> {
    this.ensureDirectory();
    const file = this.file(slot);
    if (!file.exists) return null;
    const envelope = JSON.parse(await file.text()) as StoredFileEnvelope;
    return validateContentPayload(envelope.raw, envelope.manifest);
  }

  async readActive(): Promise<StoredContent | null> {
    return this.readSlot('active');
  }

  async stage(candidate: StoredContent): Promise<void> {
    this.ensureDirectory();
    const staged = this.file('staged');
    if (!staged.exists) staged.create({ intermediates: true });
    staged.write(JSON.stringify({ manifest: candidate.manifest, raw: candidate.raw }));
    const verified = await this.readSlot('staged');
    if (!verified || verified.manifest.checksum !== candidate.manifest.checksum) {
      throw new Error('Staged content verification failed');
    }
  }

  async activate(): Promise<void> {
    this.ensureDirectory();
    const staged = this.file('staged');
    if (!staged.exists) throw new Error('No content has been staged');
    const active = this.file('active');
    const previous = this.file('previous');
    if (previous.exists) previous.delete();
    if (active.exists) await active.move(previous, { overwrite: true });
    // Leave `previous` in place if this move throws; the updater owns rollback.
    await staged.move(this.file('active'), { overwrite: true });
  }

  async rollback(): Promise<void> {
    this.ensureDirectory();
    const active = this.file('active');
    const previous = this.file('previous');
    if (active.exists) active.delete();
    if (previous.exists) await previous.move(this.file('active'), { overwrite: true });
    await this.clearStaged();
  }

  async clearStaged(): Promise<void> {
    this.ensureDirectory();
    const staged = this.file('staged');
    if (staged.exists) staged.delete();
  }
}
