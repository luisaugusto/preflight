import { randomUUID } from "expo-crypto";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import type {
  ContentEntityType,
  ReviewableContentType,
} from "./content/types";

export const PREFLIGHT_DATABASE_NAME = "preflight.db";
export const PREFLIGHT_DATABASE_VERSION = 1;

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS completions (
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    content_version TEXT NOT NULL,
    score REAL,
    max_score REAL,
    PRIMARY KEY (content_id, content_type)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY NOT NULL,
    question_id TEXT NOT NULL,
    section_id TEXT,
    module_id TEXT NOT NULL,
    response_json TEXT,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    attempted_at TEXT NOT NULL,
    content_version TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS attempts_question_idx
    ON attempts (question_id, attempted_at DESC);
  CREATE INDEX IF NOT EXISTS attempts_section_idx
    ON attempts (section_id, attempted_at DESC);

  CREATE TABLE IF NOT EXISTS resume_positions (
    module_id TEXT PRIMARY KEY NOT NULL,
    section_id TEXT,
    lesson_id TEXT,
    block_index INTEGER NOT NULL DEFAULT 0 CHECK (block_index >= 0),
    content_version TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_state (
    slot TEXT PRIMARY KEY NOT NULL CHECK (slot = 'active'),
    version TEXT NOT NULL,
    checksum TEXT NOT NULL,
    previous_version TEXT,
    manifest_json TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mistakes (
    question_id TEXT PRIMARY KEY NOT NULL,
    section_id TEXT,
    module_id TEXT NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
    last_response_json TEXT,
    last_attempt_at TEXT NOT NULL,
    resolved_at TEXT,
    content_version TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mistakes_unresolved_idx
    ON mistakes (resolved_at, last_attempt_at DESC);

  CREATE TABLE IF NOT EXISTS review_cards (
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    due TEXT NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days REAL NOT NULL,
    scheduled_days REAL NOT NULL,
    learning_steps INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    state INTEGER NOT NULL,
    last_review TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (content_id, content_type)
  );
  CREATE INDEX IF NOT EXISTS review_cards_due_idx
    ON review_cards (due, content_type);

  CREATE TABLE IF NOT EXISTS review_logs (
    id TEXT PRIMARY KEY NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    rating INTEGER NOT NULL,
    previous_state INTEGER NOT NULL,
    due TEXT NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days REAL NOT NULL,
    scheduled_days REAL NOT NULL,
    learning_steps INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS review_logs_content_idx
    ON review_logs (content_id, reviewed_at DESC);
  `,
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const versionRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion > PREFLIGHT_DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${PREFLIGHT_DATABASE_VERSION}`,
    );
  }
  if (currentVersion === PREFLIGHT_DATABASE_VERSION) return;

  await db.withTransactionAsync(async () => {
    for (let version = currentVersion + 1; version <= PREFLIGHT_DATABASE_VERSION; version += 1) {
      const migration = MIGRATIONS[version - 1];
      if (!migration) throw new Error(`Missing database migration ${version}`);
      await db.execAsync(migration);
      await db.execAsync(`PRAGMA user_version = ${version}`);
    }
  });
}

export async function openPreflightDatabase(
  databaseName = PREFLIGHT_DATABASE_NAME,
): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(databaseName);
  await migrateDatabase(db);
  return db;
}

function toIso(value: string | Date | undefined): string {
  const date = value === undefined ? new Date() : value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Expected a valid date");
  return date.toISOString();
}

function stringifyJson(value: unknown): string | null {
  if (value === undefined) return null;
  const serialized = JSON.stringify(value);
  return serialized === undefined ? null : serialized;
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export interface CompletionRecord {
  contentId: string;
  contentType: ContentEntityType;
  completedAt: string;
  contentVersion: string;
  score: number | null;
  maxScore: number | null;
}

export interface SaveCompletionInput {
  contentId: string;
  contentType: ContentEntityType;
  completedAt?: string | Date;
  contentVersion: string;
  score?: number | null;
  maxScore?: number | null;
}

export interface AttemptRecord {
  id: string;
  questionId: string;
  sectionId: string | null;
  moduleId: string;
  response: unknown;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  attemptedAt: string;
  contentVersion: string;
}

export interface RecordAttemptInput {
  id?: string;
  questionId: string;
  sectionId?: string | null;
  moduleId: string;
  response?: unknown;
  isCorrect: boolean;
  score: number;
  maxScore?: number;
  attemptedAt?: string | Date;
  contentVersion: string;
}

export interface AttemptQuery {
  questionId?: string;
  sectionId?: string;
  limit?: number;
}

export interface MistakeRecord {
  questionId: string;
  sectionId: string | null;
  moduleId: string;
  occurrenceCount: number;
  lastResponse: unknown;
  lastAttemptAt: string;
  resolvedAt: string | null;
  contentVersion: string;
}

export interface ResumePosition {
  moduleId: string;
  sectionId: string | null;
  lessonId: string | null;
  blockIndex: number;
  contentVersion: string;
  updatedAt: string;
}

export interface SaveResumePositionInput {
  moduleId: string;
  sectionId?: string | null;
  lessonId?: string | null;
  blockIndex?: number;
  contentVersion: string;
  updatedAt?: string | Date;
}

export interface ContentStateRecord {
  version: string;
  checksum: string;
  previousVersion: string | null;
  manifest: unknown;
  updatedAt: string;
}

export interface SaveContentStateInput {
  version: string;
  checksum: string;
  previousVersion?: string | null;
  manifest?: unknown;
  updatedAt?: string | Date;
}

export interface ReviewCardRecord {
  contentId: string;
  contentType: ReviewableContentType;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
  updatedAt: string;
}

export interface ReviewLogRecord {
  id?: string;
  contentId: string;
  contentType: ReviewableContentType;
  rating: number;
  previousState: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reviewedAt: string;
}

interface CompletionRow {
  content_id: string;
  content_type: ContentEntityType;
  completed_at: string;
  content_version: string;
  score: number | null;
  max_score: number | null;
}

interface AttemptRow {
  id: string;
  question_id: string;
  section_id: string | null;
  module_id: string;
  response_json: string | null;
  is_correct: number;
  score: number;
  max_score: number;
  attempted_at: string;
  content_version: string;
}

interface MistakeRow {
  question_id: string;
  section_id: string | null;
  module_id: string;
  occurrence_count: number;
  last_response_json: string | null;
  last_attempt_at: string;
  resolved_at: string | null;
  content_version: string;
}

interface ResumeRow {
  module_id: string;
  section_id: string | null;
  lesson_id: string | null;
  block_index: number;
  content_version: string;
  updated_at: string;
}

interface ContentStateRow {
  version: string;
  checksum: string;
  previous_version: string | null;
  manifest_json: string | null;
  updated_at: string;
}

interface ReviewCardRow {
  content_id: string;
  content_type: ReviewableContentType;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  updated_at: string;
}

function completionFromRow(row: CompletionRow): CompletionRecord {
  return {
    contentId: row.content_id,
    contentType: row.content_type,
    completedAt: row.completed_at,
    contentVersion: row.content_version,
    score: row.score,
    maxScore: row.max_score,
  };
}

function attemptFromRow(row: AttemptRow): AttemptRecord {
  return {
    id: row.id,
    questionId: row.question_id,
    sectionId: row.section_id,
    moduleId: row.module_id,
    response: parseJson(row.response_json),
    isCorrect: row.is_correct === 1,
    score: row.score,
    maxScore: row.max_score,
    attemptedAt: row.attempted_at,
    contentVersion: row.content_version,
  };
}

function mistakeFromRow(row: MistakeRow): MistakeRecord {
  return {
    questionId: row.question_id,
    sectionId: row.section_id,
    moduleId: row.module_id,
    occurrenceCount: row.occurrence_count,
    lastResponse: parseJson(row.last_response_json),
    lastAttemptAt: row.last_attempt_at,
    resolvedAt: row.resolved_at,
    contentVersion: row.content_version,
  };
}

function reviewCardFromRow(row: ReviewCardRow): ReviewCardRecord {
  return {
    contentId: row.content_id,
    contentType: row.content_type,
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsed_days,
    scheduledDays: row.scheduled_days,
    learningSteps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.last_review,
    updatedAt: row.updated_at,
  };
}

export class PreflightRepository {
  constructor(readonly db: SQLiteDatabase) {}

  async initialize(): Promise<this> {
    await migrateDatabase(this.db);
    return this;
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }

  async saveCompletion(input: SaveCompletionInput): Promise<CompletionRecord> {
    const completedAt = toIso(input.completedAt);
    await this.db.runAsync(
      `INSERT INTO completions
        (content_id, content_type, completed_at, content_version, score, max_score)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(content_id, content_type) DO UPDATE SET
        completed_at = excluded.completed_at,
        content_version = excluded.content_version,
        score = excluded.score,
        max_score = excluded.max_score`,
      [
        input.contentId,
        input.contentType,
        completedAt,
        input.contentVersion,
        input.score ?? null,
        input.maxScore ?? null,
      ],
    );
    return {
      contentId: input.contentId,
      contentType: input.contentType,
      completedAt,
      contentVersion: input.contentVersion,
      score: input.score ?? null,
      maxScore: input.maxScore ?? null,
    };
  }

  /** Convenience alias for UI code. */
  markCompleted(input: SaveCompletionInput): Promise<CompletionRecord> {
    return this.saveCompletion(input);
  }

  async getCompletion(
    contentId: string,
    contentType?: ContentEntityType,
  ): Promise<CompletionRecord | null> {
    const row = contentType
      ? await this.db.getFirstAsync<CompletionRow>(
          "SELECT * FROM completions WHERE content_id = ? AND content_type = ?",
          [contentId, contentType],
        )
      : await this.db.getFirstAsync<CompletionRow>(
          "SELECT * FROM completions WHERE content_id = ? ORDER BY completed_at DESC LIMIT 1",
          [contentId],
        );
    return row ? completionFromRow(row) : null;
  }

  async listCompletions(contentType?: ContentEntityType): Promise<CompletionRecord[]> {
    const rows = contentType
      ? await this.db.getAllAsync<CompletionRow>(
          "SELECT * FROM completions WHERE content_type = ? ORDER BY completed_at",
          [contentType],
        )
      : await this.db.getAllAsync<CompletionRow>("SELECT * FROM completions ORDER BY completed_at");
    return rows.map(completionFromRow);
  }

  async removeCompletion(contentId: string, contentType?: ContentEntityType): Promise<void> {
    if (contentType) {
      await this.db.runAsync(
        "DELETE FROM completions WHERE content_id = ? AND content_type = ?",
        [contentId, contentType],
      );
    } else {
      await this.db.runAsync("DELETE FROM completions WHERE content_id = ?", [contentId]);
    }
  }

  async recordAttempt(input: RecordAttemptInput): Promise<AttemptRecord> {
    if (!Number.isFinite(input.score) || !Number.isFinite(input.maxScore ?? 1)) {
      throw new TypeError("Attempt scores must be finite numbers");
    }
    const maxScore = input.maxScore ?? 1;
    if (maxScore <= 0 || input.score < 0 || input.score > maxScore) {
      throw new RangeError("Attempt score must be between zero and maxScore");
    }
    const id = input.id ?? randomUUID();
    const attemptedAt = toIso(input.attemptedAt);
    const responseJson = stringifyJson(input.response);

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO attempts
          (id, question_id, section_id, module_id, response_json, is_correct, score, max_score, attempted_at, content_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.questionId,
          input.sectionId ?? null,
          input.moduleId,
          responseJson,
          input.isCorrect ? 1 : 0,
          input.score,
          maxScore,
          attemptedAt,
          input.contentVersion,
        ],
      );

      if (input.isCorrect) {
        await this.db.runAsync(
          "UPDATE mistakes SET resolved_at = ?, last_attempt_at = ? WHERE question_id = ?",
          [attemptedAt, attemptedAt, input.questionId],
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO mistakes
            (question_id, section_id, module_id, occurrence_count, last_response_json, last_attempt_at, resolved_at, content_version)
           VALUES (?, ?, ?, 1, ?, ?, NULL, ?)
           ON CONFLICT(question_id) DO UPDATE SET
            section_id = excluded.section_id,
            module_id = excluded.module_id,
            occurrence_count = mistakes.occurrence_count + 1,
            last_response_json = excluded.last_response_json,
            last_attempt_at = excluded.last_attempt_at,
            resolved_at = NULL,
            content_version = excluded.content_version`,
          [
            input.questionId,
            input.sectionId ?? null,
            input.moduleId,
            responseJson,
            attemptedAt,
            input.contentVersion,
          ],
        );
      }
    });

    return {
      id,
      questionId: input.questionId,
      sectionId: input.sectionId ?? null,
      moduleId: input.moduleId,
      response: input.response ?? null,
      isCorrect: input.isCorrect,
      score: input.score,
      maxScore,
      attemptedAt,
      contentVersion: input.contentVersion,
    };
  }

  async listAttempts(query: AttemptQuery = {}): Promise<AttemptRecord[]> {
    const limit = Math.min(1000, Math.max(1, Math.trunc(query.limit ?? 100)));
    let rows: AttemptRow[];
    if (query.questionId) {
      rows = await this.db.getAllAsync<AttemptRow>(
        "SELECT * FROM attempts WHERE question_id = ? ORDER BY attempted_at DESC LIMIT ?",
        [query.questionId, limit],
      );
    } else if (query.sectionId) {
      rows = await this.db.getAllAsync<AttemptRow>(
        "SELECT * FROM attempts WHERE section_id = ? ORDER BY attempted_at DESC LIMIT ?",
        [query.sectionId, limit],
      );
    } else {
      rows = await this.db.getAllAsync<AttemptRow>(
        "SELECT * FROM attempts ORDER BY attempted_at DESC LIMIT ?",
        [limit],
      );
    }
    return rows.map(attemptFromRow);
  }

  async listMistakes(unresolvedOnly = true): Promise<MistakeRecord[]> {
    const rows = unresolvedOnly
      ? await this.db.getAllAsync<MistakeRow>(
          "SELECT * FROM mistakes WHERE resolved_at IS NULL ORDER BY last_attempt_at DESC",
        )
      : await this.db.getAllAsync<MistakeRow>(
          "SELECT * FROM mistakes ORDER BY last_attempt_at DESC",
        );
    return rows.map(mistakeFromRow);
  }

  async resolveMistake(questionId: string, resolvedAt?: string | Date): Promise<void> {
    await this.db.runAsync("UPDATE mistakes SET resolved_at = ? WHERE question_id = ?", [
      toIso(resolvedAt),
      questionId,
    ]);
  }

  async saveResumePosition(input: SaveResumePositionInput): Promise<ResumePosition> {
    const blockIndex = input.blockIndex ?? 0;
    if (!Number.isInteger(blockIndex) || blockIndex < 0) {
      throw new RangeError("blockIndex must be a non-negative integer");
    }
    const updatedAt = toIso(input.updatedAt);
    await this.db.runAsync(
      `INSERT INTO resume_positions
        (module_id, section_id, lesson_id, block_index, content_version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(module_id) DO UPDATE SET
        section_id = excluded.section_id,
        lesson_id = excluded.lesson_id,
        block_index = excluded.block_index,
        content_version = excluded.content_version,
        updated_at = excluded.updated_at`,
      [
        input.moduleId,
        input.sectionId ?? null,
        input.lessonId ?? null,
        blockIndex,
        input.contentVersion,
        updatedAt,
      ],
    );
    return {
      moduleId: input.moduleId,
      sectionId: input.sectionId ?? null,
      lessonId: input.lessonId ?? null,
      blockIndex,
      contentVersion: input.contentVersion,
      updatedAt,
    };
  }

  async getResumePosition(moduleId: string): Promise<ResumePosition | null> {
    const row = await this.db.getFirstAsync<ResumeRow>(
      "SELECT * FROM resume_positions WHERE module_id = ?",
      [moduleId],
    );
    return row
      ? {
          moduleId: row.module_id,
          sectionId: row.section_id,
          lessonId: row.lesson_id,
          blockIndex: row.block_index,
          contentVersion: row.content_version,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async clearResumePosition(moduleId: string): Promise<void> {
    await this.db.runAsync("DELETE FROM resume_positions WHERE module_id = ?", [moduleId]);
  }

  async saveContentState(input: SaveContentStateInput): Promise<ContentStateRecord> {
    const updatedAt = toIso(input.updatedAt);
    const manifestJson = stringifyJson(input.manifest);
    await this.db.runAsync(
      `INSERT INTO content_state
        (slot, version, checksum, previous_version, manifest_json, updated_at)
       VALUES ('active', ?, ?, ?, ?, ?)
       ON CONFLICT(slot) DO UPDATE SET
        version = excluded.version,
        checksum = excluded.checksum,
        previous_version = excluded.previous_version,
        manifest_json = excluded.manifest_json,
        updated_at = excluded.updated_at`,
      [
        input.version,
        input.checksum,
        input.previousVersion ?? null,
        manifestJson,
        updatedAt,
      ],
    );
    return {
      version: input.version,
      checksum: input.checksum,
      previousVersion: input.previousVersion ?? null,
      manifest: input.manifest ?? null,
      updatedAt,
    };
  }

  async getContentState(): Promise<ContentStateRecord | null> {
    const row = await this.db.getFirstAsync<ContentStateRow>(
      "SELECT version, checksum, previous_version, manifest_json, updated_at FROM content_state WHERE slot = 'active'",
    );
    return row
      ? {
          version: row.version,
          checksum: row.checksum,
          previousVersion: row.previous_version,
          manifest: parseJson(row.manifest_json),
          updatedAt: row.updated_at,
        }
      : null;
  }

  async upsertReviewCard(card: ReviewCardRecord): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO review_cards
        (content_id, content_type, due, stability, difficulty, elapsed_days, scheduled_days,
         learning_steps, reps, lapses, state, last_review, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(content_id, content_type) DO UPDATE SET
        due = excluded.due,
        stability = excluded.stability,
        difficulty = excluded.difficulty,
        elapsed_days = excluded.elapsed_days,
        scheduled_days = excluded.scheduled_days,
        learning_steps = excluded.learning_steps,
        reps = excluded.reps,
        lapses = excluded.lapses,
        state = excluded.state,
        last_review = excluded.last_review,
        updated_at = excluded.updated_at`,
      [
        card.contentId,
        card.contentType,
        toIso(card.due),
        card.stability,
        card.difficulty,
        card.elapsedDays,
        card.scheduledDays,
        card.learningSteps,
        card.reps,
        card.lapses,
        card.state,
        card.lastReview ? toIso(card.lastReview) : null,
        toIso(card.updatedAt),
      ],
    );
  }

  async getReviewCard(
    contentId: string,
    contentType?: ReviewableContentType,
  ): Promise<ReviewCardRecord | null> {
    const row = contentType
      ? await this.db.getFirstAsync<ReviewCardRow>(
          "SELECT * FROM review_cards WHERE content_id = ? AND content_type = ?",
          [contentId, contentType],
        )
      : await this.db.getFirstAsync<ReviewCardRow>(
          "SELECT * FROM review_cards WHERE content_id = ? LIMIT 1",
          [contentId],
        );
    return row ? reviewCardFromRow(row) : null;
  }

  async listDueReviewCards(
    now: string | Date = new Date(),
    limit = 100,
  ): Promise<ReviewCardRecord[]> {
    const safeLimit = Math.min(1000, Math.max(1, Math.trunc(limit)));
    const rows = await this.db.getAllAsync<ReviewCardRow>(
      "SELECT * FROM review_cards WHERE due <= ? ORDER BY due LIMIT ?",
      [toIso(now), safeLimit],
    );
    return rows.map(reviewCardFromRow);
  }

  async saveReview(card: ReviewCardRecord, log: ReviewLogRecord): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.upsertReviewCard(card);
      await this.db.runAsync(
        `INSERT INTO review_logs
          (id, content_id, content_type, rating, previous_state, due, stability, difficulty,
           elapsed_days, scheduled_days, learning_steps, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.id ?? randomUUID(),
          log.contentId,
          log.contentType,
          log.rating,
          log.previousState,
          toIso(log.due),
          log.stability,
          log.difficulty,
          log.elapsedDays,
          log.scheduledDays,
          log.learningSteps,
          toIso(log.reviewedAt),
        ],
      );
    });
  }

  async clearAllLearningData(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        DELETE FROM review_logs;
        DELETE FROM review_cards;
        DELETE FROM mistakes;
        DELETE FROM resume_positions;
        DELETE FROM attempts;
        DELETE FROM completions;
      `);
    });
  }
}

export async function createPreflightRepository(
  databaseName = PREFLIGHT_DATABASE_NAME,
): Promise<PreflightRepository> {
  return new PreflightRepository(await openPreflightDatabase(databaseName));
}

