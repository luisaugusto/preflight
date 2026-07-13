/**
 * Canonical, platform-independent content contract for the Preflight PHAK module.
 *
 * `phak.json` is a single {@link ModuleContent} object. Runtime sync may wrap it
 * in a manifest, but callers should always normalize back to this shape.
 */

export type ContentId = string;
export type AcsCode = string;

export interface SourceCitation {
  handbook: string;
  edition: string;
  chapter: string;
  /** Printed handbook page, for example `3-7`. */
  page: string | number;
  url: string;
  figure?: string;
}

export interface ModuleSource {
  title: string;
  url: string;
  edition: string;
  /** SHA-256 (preferred) or other source checksum recorded by the pipeline. */
  checksum: string;
}

export interface AcsReference {
  code: AcsCode;
  title?: string;
  area?: string;
  task?: string;
  element?: string;
}

export interface QuestionImage {
  uri: string;
  alt: string;
  caption: string;
  sourcePage: string | number;
}

export interface NumericAnswerSpec {
  value: number;
  tolerance: number;
  unit: string;
  /** Human-readable examples or unit aliases accepted by the authoring pipeline. */
  acceptedFormats?: string[];
}

export interface MatchingPair {
  id: ContentId;
  left: string;
  right: string;
}

interface BaseQuestion {
  id: ContentId;
  prompt: string;
  explanation: string;
  sourceCitation: SourceCitation;
  acsCodes: AcsCode[];
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multipleChoice';
  options: string[];
  correctIndex: number;
}

export interface ImageQuestion extends BaseQuestion {
  type: 'image';
  image: QuestionImage;
  options: string[];
  correctIndex: number;
}

export interface NumericQuestion extends BaseQuestion {
  type: 'numeric';
  answer: NumericAnswerSpec;
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching';
  pairs: MatchingPair[];
}

export type Question = MultipleChoiceQuestion | ImageQuestion | NumericQuestion | MatchingQuestion;

export interface Lesson {
  id: ContentId;
  title: string;
  order: number;
  estimatedMinutes: number;
  concept: string;
  explanation: string;
  workedExample: string;
  sourceCitation: SourceCitation;
  acsCodes: AcsCode[];
  practice: Question;
}

export interface Section {
  id: ContentId;
  title: string;
  order: number;
  summary: string;
  /** Printed page range, for example `1-1–1-18`. */
  sourcePages: string;
  acsCodes: AcsCode[];
  lessons: Lesson[];
  quiz: Question[];
}

export interface GlossaryTerm {
  id: ContentId;
  term: string;
  definition: string;
  sectionId: ContentId;
  sourceCitation: SourceCitation;
  acsCodes: AcsCode[];
}

export interface ModuleContent {
  id: ContentId;
  title: string;
  shortTitle: string;
  description: string;
  version: string;
  source: ModuleSource;
  sections: Section[];
  exam: Question[];
  glossary: GlossaryTerm[];
}

/** Optional network envelope; this is not the checked-in `phak.json` shape. */
export interface ContentBundle {
  schemaVersion: number;
  contentVersion: string;
  generatedAt?: string;
  module: ModuleContent;
}

export type ContentEntityType = 'module' | 'section' | 'lesson' | 'question' | 'glossaryTerm';

export type ReviewableContentType = 'lesson' | 'question' | 'glossaryTerm';
