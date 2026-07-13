import type {
  MatchingQuestion,
  ModuleContent,
  NumericAnswerSpec,
  Question,
  Section,
} from './content/types';

export type ChoiceResponse = number | string | { selectedIndex: number };
export type NumericResponse = number | string | { value: number | string; unit?: string };
export type MatchingResponse =
  | Record<string, string>
  | { matches: Record<string, string> }
  | { leftId: string; rightId: string }[];
export type QuestionResponse =
  ChoiceResponse | NumericResponse | MatchingResponse | null | undefined;

export type ScoringReason =
  'correct' | 'incorrect' | 'unanswered' | 'invalidNumber' | 'invalidUnit' | 'partiallyCorrect';

export interface QuestionScore {
  questionId: string;
  isCorrect: boolean;
  score: number;
  maxScore: 1;
  reason: ScoringReason;
  explanation: string;
  normalizedResponse?: number | Record<string, string>;
  correctAnswer: number | NumericAnswerSpec | Record<string, string>;
  details?: {
    correctPairs?: number;
    totalPairs?: number;
    expectedUnit?: string;
    providedUnit?: string;
    delta?: number;
  };
}

export interface AssessmentScore {
  score: number;
  maxScore: number;
  correctCount: number;
  questionCount: number;
  answeredCount: number;
  percentage: number;
  passed: boolean;
  passThreshold: number;
  questions: QuestionScore[];
}

export interface ParsedNumericInput {
  valid: boolean;
  value?: number;
  providedUnit?: string;
  expectedUnit: string;
  reason?: 'invalidNumber' | 'invalidUnit';
}

interface UnitDefinition {
  dimension: string;
  factor: number;
  offset?: number;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  lb: { dimension: 'mass', factor: 0.45359237 },
  kg: { dimension: 'mass', factor: 1 },
  oz: { dimension: 'mass', factor: 0.028349523125 },
  ft: { dimension: 'distance', factor: 0.3048 },
  in: { dimension: 'distance', factor: 0.0254 },
  m: { dimension: 'distance', factor: 1 },
  km: { dimension: 'distance', factor: 1000 },
  nm: { dimension: 'distance', factor: 1852 },
  mi: { dimension: 'distance', factor: 1609.344 },
  kt: { dimension: 'speed', factor: 0.5144444444444445 },
  mph: { dimension: 'speed', factor: 0.44704 },
  'km/h': { dimension: 'speed', factor: 0.2777777777777778 },
  'ft/min': { dimension: 'verticalSpeed', factor: 0.00508 },
  inhg: { dimension: 'pressure', factor: 3386.389 },
  hpa: { dimension: 'pressure', factor: 100 },
  gal: { dimension: 'volume', factor: 3.785411784 },
  l: { dimension: 'volume', factor: 1 },
  min: { dimension: 'time', factor: 60 },
  h: { dimension: 'time', factor: 3600 },
  s: { dimension: 'time', factor: 1 },
  deg: { dimension: 'angle', factor: 1 },
  '%': { dimension: 'percent', factor: 1 },
  c: { dimension: 'temperature', factor: 1, offset: 0 },
  f: { dimension: 'temperature', factor: 5 / 9, offset: -32 },
};

const UNIT_ALIASES: Record<string, string> = {
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  ft: 'ft',
  foot: 'ft',
  feet: 'ft',
  in: 'in',
  inch: 'in',
  inches: 'in',
  m: 'm',
  meter: 'm',
  meters: 'm',
  metre: 'm',
  metres: 'm',
  km: 'km',
  kilometer: 'km',
  kilometers: 'km',
  nm: 'nm',
  nmi: 'nm',
  'nautical mile': 'nm',
  'nautical miles': 'nm',
  mi: 'mi',
  mile: 'mi',
  miles: 'mi',
  kt: 'kt',
  kts: 'kt',
  knot: 'kt',
  knots: 'kt',
  mph: 'mph',
  'mi/h': 'mph',
  kph: 'km/h',
  kmh: 'km/h',
  'km/h': 'km/h',
  fpm: 'ft/min',
  'ft/min': 'ft/min',
  inhg: 'inhg',
  'in hg': 'inhg',
  hpa: 'hpa',
  mb: 'hpa',
  mbar: 'hpa',
  millibar: 'hpa',
  millibars: 'hpa',
  gal: 'gal',
  gals: 'gal',
  gallon: 'gal',
  gallons: 'gal',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  min: 'min',
  mins: 'min',
  minute: 'min',
  minutes: 'min',
  hr: 'h',
  hrs: 'h',
  hour: 'h',
  hours: 'h',
  h: 'h',
  sec: 's',
  secs: 's',
  second: 's',
  seconds: 's',
  s: 's',
  degree: 'deg',
  degrees: 'deg',
  deg: 'deg',
  '°': 'deg',
  '%': '%',
  percent: '%',
  percentage: '%',
  c: 'c',
  '°c': 'c',
  celsius: 'c',
  f: 'f',
  '°f': 'f',
  fahrenheit: 'f',
};

function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/[.,]+$/g, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

function canonicalUnit(unit: string): string {
  const normalized = normalizeUnit(unit);
  return UNIT_ALIASES[normalized] ?? normalized;
}

function parseNumberAndUnit(
  input: number | string,
): { value: number; unit: string } | { value?: undefined; unit: string } {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? { value: input, unit: '' } : { unit: '' };
  }

  const normalized = input
    .trim()
    .replace(/[−–—]/g, '-')
    // METAR convention: M02 means minus 2 °C.
    .replace(/^M(?=\d)/i, '-');
  const match = normalized.match(
    /^([+-]?)\s*(?:(\d[\d,]*(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|((?:\d[\d,]*)(?:\.\d+)?|\.\d+))\s*(.*?)$/,
  );
  if (!match) return { unit: '' };

  const sign = match[1] === '-' ? -1 : 1;
  let value: number;
  if (match[2] !== undefined) {
    const denominator = Number(match[4]);
    if (denominator === 0) return { unit: '' };
    value = Number(match[2].replace(/,/g, '')) + Number(match[3]) / denominator;
  } else if (match[5] !== undefined) {
    const denominator = Number(match[6]);
    if (denominator === 0) return { unit: '' };
    value = Number(match[5]) / denominator;
  } else {
    value = Number(match[7]?.replace(/,/g, ''));
  }

  if (!Number.isFinite(value)) return { unit: '' };
  return { value: sign * value, unit: match[8]?.trim() ?? '' };
}

function convertUnit(value: number, from: string, to: string): number | null {
  const fromCanonical = canonicalUnit(from);
  const toCanonical = canonicalUnit(to);
  if (fromCanonical === toCanonical) return value;

  const source = UNIT_DEFINITIONS[fromCanonical];
  const target = UNIT_DEFINITIONS[toCanonical];
  if (!source || !target || source.dimension !== target.dimension) return null;

  if (source.dimension === 'temperature') {
    const celsius = fromCanonical === 'f' ? (value - 32) * (5 / 9) : value;
    return toCanonical === 'f' ? celsius * (9 / 5) + 32 : celsius;
  }

  return (value * source.factor) / target.factor;
}

export function parseNumericInput(
  input: NumericResponse,
  answer: Pick<NumericAnswerSpec, 'unit' | 'acceptedFormats'>,
): ParsedNumericInput {
  if (input === null || input === undefined) {
    return { valid: false, expectedUnit: answer.unit, reason: 'invalidNumber' };
  }

  let rawValue: number | string;
  let explicitUnit = '';
  if (typeof input === 'object') {
    rawValue = input.value;
    explicitUnit = input.unit?.trim() ?? '';
  } else {
    rawValue = input;
  }

  const parsed = parseNumberAndUnit(rawValue);
  if (parsed.value === undefined) {
    return { valid: false, expectedUnit: answer.unit, reason: 'invalidNumber' };
  }

  const providedUnit = explicitUnit || parsed.unit;
  if (!providedUnit || !answer.unit) {
    return {
      valid: true,
      value: parsed.value,
      providedUnit: providedUnit || undefined,
      expectedUnit: answer.unit,
    };
  }

  const converted = convertUnit(parsed.value, providedUnit, answer.unit);
  if (converted === null) {
    return {
      valid: false,
      expectedUnit: answer.unit,
      providedUnit,
      reason: 'invalidUnit',
    };
  }

  return {
    valid: true,
    value: converted,
    providedUnit,
    expectedUnit: answer.unit,
  };
}

function choiceIndex(question: Question, response: QuestionResponse): number | undefined {
  if (typeof response === 'number' && Number.isInteger(response)) return response;
  if (typeof response === 'object' && response && 'selectedIndex' in response) {
    const selectedIndex = response.selectedIndex;
    return typeof selectedIndex === 'number' && Number.isInteger(selectedIndex)
      ? selectedIndex
      : undefined;
  }
  if (
    typeof response === 'string' &&
    (question.type === 'multipleChoice' || question.type === 'image')
  ) {
    const exactIndex = question.options.indexOf(response);
    if (exactIndex >= 0) return exactIndex;
    if (/^\d+$/.test(response.trim())) return Number(response.trim());
  }
  return undefined;
}

function normalizeMatches(response: QuestionResponse): Record<string, string> {
  if (!response || typeof response !== 'object') return {};
  if (Array.isArray(response)) {
    return Object.fromEntries(response.map((match) => [match.leftId, match.rightId]));
  }
  if ('matches' in response) {
    const matches = response.matches;
    return matches && typeof matches === 'object' && !Array.isArray(matches)
      ? (matches as Record<string, string>)
      : {};
  }
  return response as Record<string, string>;
}

function scoreMatching(question: MatchingQuestion, response: QuestionResponse): QuestionScore {
  const matches = normalizeMatches(response);
  let correctPairs = 0;
  const normalizedResponse: Record<string, string> = {};
  const correctAnswer: Record<string, string> = {};

  for (const pair of question.pairs) {
    const submitted = matches[pair.id] ?? matches[pair.left];
    if (submitted !== undefined) normalizedResponse[pair.id] = submitted;
    correctAnswer[pair.id] = pair.id;
    if (submitted === pair.id || submitted === pair.right) correctPairs += 1;
  }

  const score = question.pairs.length === 0 ? 0 : correctPairs / question.pairs.length;
  const answered = Object.keys(normalizedResponse).length > 0;
  return {
    questionId: question.id,
    isCorrect: score === 1,
    score,
    maxScore: 1,
    reason: !answered
      ? 'unanswered'
      : score === 1
        ? 'correct'
        : score > 0
          ? 'partiallyCorrect'
          : 'incorrect',
    explanation: question.explanation,
    normalizedResponse,
    correctAnswer,
    details: { correctPairs, totalPairs: question.pairs.length },
  };
}

export function scoreQuestion(question: Question, response: QuestionResponse): QuestionScore {
  if (question.type === 'matching') return scoreMatching(question, response);

  if (question.type === 'numeric') {
    const parsed = parseNumericInput(response as NumericResponse, question.answer);
    if (!parsed.valid || parsed.value === undefined) {
      return {
        questionId: question.id,
        isCorrect: false,
        score: 0,
        maxScore: 1,
        reason:
          response === null || response === undefined
            ? 'unanswered'
            : (parsed.reason ?? 'invalidNumber'),
        explanation: question.explanation,
        correctAnswer: question.answer,
        details: {
          expectedUnit: question.answer.unit,
          providedUnit: parsed.providedUnit,
        },
      };
    }

    const delta = Math.abs(parsed.value - question.answer.value);
    const isCorrect = delta <= question.answer.tolerance + Number.EPSILON;
    return {
      questionId: question.id,
      isCorrect,
      score: isCorrect ? 1 : 0,
      maxScore: 1,
      reason: isCorrect ? 'correct' : 'incorrect',
      explanation: question.explanation,
      normalizedResponse: parsed.value,
      correctAnswer: question.answer,
      details: {
        expectedUnit: question.answer.unit,
        providedUnit: parsed.providedUnit,
        delta,
      },
    };
  }

  const selectedIndex = choiceIndex(question, response);
  const isCorrect = selectedIndex === question.correctIndex;
  return {
    questionId: question.id,
    isCorrect,
    score: isCorrect ? 1 : 0,
    maxScore: 1,
    reason: selectedIndex === undefined ? 'unanswered' : isCorrect ? 'correct' : 'incorrect',
    explanation: question.explanation,
    normalizedResponse: selectedIndex,
    correctAnswer: question.correctIndex,
  };
}

export function scoreAssessment(
  questions: readonly Question[],
  responses: Readonly<Record<string, QuestionResponse>> | ReadonlyMap<string, QuestionResponse>,
  passThreshold = 0.8,
): AssessmentScore {
  if (passThreshold < 0 || passThreshold > 1) {
    throw new RangeError('passThreshold must be between 0 and 1');
  }

  const getResponse = (id: string): QuestionResponse =>
    responses instanceof Map
      ? responses.get(id)
      : (responses as Readonly<Record<string, QuestionResponse>>)[id];
  const scored = questions.map((question) => scoreQuestion(question, getResponse(question.id)));
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const maxScore = scored.length;
  const percentage = maxScore === 0 ? 0 : (score / maxScore) * 100;

  return {
    score,
    maxScore,
    correctCount: scored.filter((item) => item.isCorrect).length,
    questionCount: scored.length,
    answeredCount: scored.filter((item) => item.reason !== 'unanswered').length,
    percentage,
    passed: maxScore > 0 && score / maxScore >= passThreshold,
    passThreshold,
    questions: scored,
  };
}

export function scoreSectionQuiz(
  section: Pick<Section, 'quiz'>,
  responses: Readonly<Record<string, QuestionResponse>> | ReadonlyMap<string, QuestionResponse>,
  passThreshold = 0.8,
): AssessmentScore {
  return scoreAssessment(section.quiz, responses, passThreshold);
}

export function scoreModuleExam(
  module: Pick<ModuleContent, 'exam'>,
  responses: Readonly<Record<string, QuestionResponse>> | ReadonlyMap<string, QuestionResponse>,
  passThreshold = 0.8,
): AssessmentScore {
  return scoreAssessment(module.exam, responses, passThreshold);
}
