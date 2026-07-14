/** Canonical, platform-independent content contracts for the Preflight curriculum. */

export type ContentId = string;
export type AcsCode = string;

export interface SourceCitation {
  handbook: string;
  edition: string;
  chapter: string;
  /** Printed handbook page, for example `3-7`. */
  page: string | number;
  /** One-based physical page in the pinned source PDF. */
  pdfPage?: number;
  /** Optional inclusive physical end page for a cited range. */
  pdfPageEnd?: number;
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
  /** Owning module and source section; required by catalog-wide practice. */
  moduleId?: ContentId;
  sectionId?: ContentId;
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
  moduleId?: ContentId;
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

/** Legacy schema-v1 network envelope. */
export interface ContentBundle {
  schemaVersion: number;
  contentVersion: string;
  generatedAt?: string;
  module: ModuleContent;
}

/** Atomic schema-v2 curriculum used by bundled and remotely synchronized content. */
export interface CurriculumBundle {
  schemaVersion: 2;
  catalogId: ContentId;
  contentVersion: string;
  generatedAt?: string;
  modules: ModuleContent[];
}

export type CurriculumContent = CurriculumBundle;

export type ContentEntityType = 'module' | 'section' | 'lesson' | 'question' | 'glossaryTerm';

export type ReviewableContentType = 'lesson' | 'question' | 'glossaryTerm';
