import type { NumericAnswerSpec } from "./content/types";

export type CalculationCategory =
  | "weightAndBalance"
  | "crosswind"
  | "performanceInterpolation";

export interface CalculationGiven {
  label: string;
  value: number | string;
  unit?: string;
}

export interface CalculationProblem {
  id: string;
  category: CalculationCategory;
  seed: string;
  prompt: string;
  givens: CalculationGiven[];
  answer: NumericAnswerSpec;
  explanation: string;
}

export interface LoadingStation {
  label: string;
  weight: number;
  arm: number;
  moment: number;
}

export interface WeightAndBalanceProblem extends CalculationProblem {
  category: "weightAndBalance";
  stations: LoadingStation[];
  totalWeight: number;
  totalMoment: number;
  centerOfGravity: number;
}

export interface CrosswindProblem extends CalculationProblem {
  category: "crosswind";
  runwayHeading: number;
  windDirection: number;
  windSpeed: number;
  angle: number;
  crosswindComponent: number;
  headwindComponent: number;
  from: "left" | "right";
}

export interface PerformanceInterpolationProblem extends CalculationProblem {
  category: "performanceInterpolation";
  lowerAltitude: number;
  upperAltitude: number;
  targetAltitude: number;
  lowerDistance: number;
  upperDistance: number;
  interpolatedDistance: number;
}

export type WeatherQuestionKind =
  | "wind"
  | "visibility"
  | "ceiling"
  | "altimeter"
  | "temperature";

export interface WeatherDecodingProblem {
  id: string;
  category: "weatherDecoding";
  seed: string;
  metar: string;
  kind: WeatherQuestionKind;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface CalculationPracticeSet {
  weightAndBalance: WeightAndBalanceProblem;
  crosswind: CrosswindProblem;
  performanceInterpolation: PerformanceInterpolationProblem;
  weatherDecoding: WeatherDecodingProblem;
}

export type Seed = string | number;

function seedToUint32(seed: Seed): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A small deterministic PRNG suitable for repeatable practice content, not security. */
export function createSeededRandom(seed: Seed): () => number {
  let value = seedToUint32(seed);
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, minimum: number, maximum: number): number {
  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

function choose<T>(random: () => number, values: readonly T[]): T {
  return values[randomInt(random, 0, values.length - 1)];
}

function round(value: number, digits = 0): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function normalizedSeed(seed: Seed, namespace: string): string {
  return `${String(seed)}:${namespace}`;
}

export function generateWeightAndBalance(seed: Seed): WeightAndBalanceProblem {
  const namespacedSeed = normalizedSeed(seed, "weight-and-balance");
  const random = createSeededRandom(namespacedSeed);
  const emptyWeight = randomInt(random, 145, 172) * 10;
  const emptyArm = randomInt(random, 386, 414) / 10;
  const frontWeight = randomInt(random, 26, 42) * 10;
  const rearWeight = randomInt(random, 0, 4) === 0 ? 0 : randomInt(random, 10, 32) * 10;
  const baggageWeight = randomInt(random, 2, 10) * 5;
  const fuelGallons = randomInt(random, 5, 12) * 4;

  const rawStations = [
    { label: "Basic empty airplane", weight: emptyWeight, arm: emptyArm },
    { label: "Front occupants", weight: frontWeight, arm: 37 },
    { label: "Rear occupants", weight: rearWeight, arm: 73 },
    { label: "Baggage", weight: baggageWeight, arm: 95 },
    { label: `Usable fuel (${fuelGallons} gal at 6 lb/gal)`, weight: fuelGallons * 6, arm: 48 },
  ];
  const stations = rawStations.map((station) => ({
    ...station,
    moment: round(station.weight * station.arm, 1),
  }));
  const totalWeight = stations.reduce((sum, station) => sum + station.weight, 0);
  const totalMoment = round(stations.reduce((sum, station) => sum + station.moment, 0), 1);
  const centerOfGravity = round(totalMoment / totalWeight, 2);

  return {
    id: `wb-${seedToUint32(namespacedSeed).toString(16)}`,
    category: "weightAndBalance",
    seed: String(seed),
    prompt: "Calculate the loaded center of gravity. Round to the nearest tenth of an inch.",
    givens: stations.flatMap((station) => [
      { label: `${station.label} weight`, value: station.weight, unit: "lb" },
      { label: `${station.label} arm`, value: station.arm, unit: "in" },
    ]),
    answer: { value: round(centerOfGravity, 1), tolerance: 0.1, unit: "in" },
    explanation: `Multiply each weight by its arm, add the moments (${totalMoment.toLocaleString("en-US")} lb-in), then divide by total weight (${totalWeight.toLocaleString("en-US")} lb). The loaded CG is ${centerOfGravity.toFixed(2)} inches aft of datum.`,
    stations,
    totalWeight,
    totalMoment,
    centerOfGravity,
  };
}

function wrapHeading(heading: number): number {
  const wrapped = ((heading % 360) + 360) % 360;
  return wrapped === 0 ? 360 : wrapped;
}

export function generateCrosswind(seed: Seed): CrosswindProblem {
  const namespacedSeed = normalizedSeed(seed, "crosswind");
  const random = createSeededRandom(namespacedSeed);
  const runwayNumber = randomInt(random, 1, 36);
  const runwayHeading = runwayNumber * 10;
  const offsetMagnitude = randomInt(random, 2, 8) * 10;
  const offset = random() < 0.5 ? -offsetMagnitude : offsetMagnitude;
  const windDirection = wrapHeading(runwayHeading + offset);
  const windSpeed = randomInt(random, 8, 25);
  const radians = (offsetMagnitude * Math.PI) / 180;
  const crosswindComponent = round(windSpeed * Math.sin(radians), 1);
  const headwindComponent = round(windSpeed * Math.cos(radians), 1);
  const from = offset < 0 ? "left" : "right";

  return {
    id: `xwind-${seedToUint32(namespacedSeed).toString(16)}`,
    category: "crosswind",
    seed: String(seed),
    prompt: `Runway ${String(runwayNumber).padStart(2, "0")} is in use. Wind is ${String(windDirection).padStart(3, "0")}° at ${windSpeed} kt. What is the crosswind component?`,
    givens: [
      { label: "Runway heading", value: runwayHeading, unit: "deg" },
      { label: "Wind direction", value: windDirection, unit: "deg" },
      { label: "Wind speed", value: windSpeed, unit: "kt" },
    ],
    answer: { value: crosswindComponent, tolerance: 0.5, unit: "kt" },
    explanation: `The wind is ${offsetMagnitude}° off the runway. Crosswind = ${windSpeed} × sin(${offsetMagnitude}°) = ${crosswindComponent.toFixed(1)} kt from the ${from}.`,
    runwayHeading,
    windDirection,
    windSpeed,
    angle: offsetMagnitude,
    crosswindComponent,
    headwindComponent,
    from,
  };
}

export function linearInterpolate(
  x: number,
  lowerX: number,
  upperX: number,
  lowerY: number,
  upperY: number,
): number {
  if (![x, lowerX, upperX, lowerY, upperY].every(Number.isFinite)) {
    throw new TypeError("Interpolation inputs must be finite numbers");
  }
  if (lowerX === upperX) throw new RangeError("Interpolation bounds must be different");
  return lowerY + ((x - lowerX) / (upperX - lowerX)) * (upperY - lowerY);
}

export function generatePerformanceInterpolation(seed: Seed): PerformanceInterpolationProblem {
  const namespacedSeed = normalizedSeed(seed, "performance-interpolation");
  const random = createSeededRandom(namespacedSeed);
  const lowerAltitude = randomInt(random, 0, 6) * 1000;
  const upperAltitude = lowerAltitude + 2000;
  const fraction = choose(random, [0.25, 0.5, 0.75] as const);
  const targetAltitude = lowerAltitude + (upperAltitude - lowerAltitude) * fraction;
  const lowerDistance = randomInt(random, 80, 125) * 10;
  const increase = randomInt(random, 24, 48) * 10;
  const upperDistance = lowerDistance + increase;
  const interpolatedDistance = round(
    linearInterpolate(
      targetAltitude,
      lowerAltitude,
      upperAltitude,
      lowerDistance,
      upperDistance,
    ),
  );

  return {
    id: `perf-${seedToUint32(namespacedSeed).toString(16)}`,
    category: "performanceInterpolation",
    seed: String(seed),
    prompt: `A takeoff table gives ${lowerDistance.toLocaleString("en-US")} ft at ${lowerAltitude.toLocaleString("en-US")} ft pressure altitude and ${upperDistance.toLocaleString("en-US")} ft at ${upperAltitude.toLocaleString("en-US")} ft. Interpolate the distance at ${targetAltitude.toLocaleString("en-US")} ft.`,
    givens: [
      { label: "Lower pressure altitude", value: lowerAltitude, unit: "ft" },
      { label: "Lower takeoff distance", value: lowerDistance, unit: "ft" },
      { label: "Upper pressure altitude", value: upperAltitude, unit: "ft" },
      { label: "Upper takeoff distance", value: upperDistance, unit: "ft" },
      { label: "Target pressure altitude", value: targetAltitude, unit: "ft" },
    ],
    answer: { value: interpolatedDistance, tolerance: 1, unit: "ft" },
    explanation: `The target lies ${(fraction * 100).toFixed(0)}% of the way between the rows. Apply that fraction to the ${increase}-ft difference: ${lowerDistance} + ${fraction} × ${increase} = ${interpolatedDistance} ft.`,
    lowerAltitude,
    upperAltitude,
    targetAltitude,
    lowerDistance,
    upperDistance,
    interpolatedDistance,
  };
}

function formatSignedTemperature(value: number): string {
  return value < 0 ? `M${String(Math.abs(value)).padStart(2, "0")}` : String(value).padStart(2, "0");
}

function shuffleAnswerOptions(
  random: () => number,
  correct: string,
  distractors: readonly string[],
): { options: string[]; correctIndex: number } {
  const uniqueDistractors = [...new Set(distractors.filter((option) => option !== correct))];
  let suffix = 1;
  while (uniqueDistractors.length < 3) {
    uniqueDistractors.push(`None of these (${suffix})`);
    suffix += 1;
  }
  const entries = [
    { text: correct, correct: true },
    ...uniqueDistractors.slice(0, 3).map((text) => ({ text, correct: false })),
  ];
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
  }
  return {
    options: entries.map((entry) => entry.text),
    correctIndex: entries.findIndex((entry) => entry.correct),
  };
}

export function generateWeatherDecoding(seed: Seed): WeatherDecodingProblem {
  const namespacedSeed = normalizedSeed(seed, "weather-decoding");
  const random = createSeededRandom(namespacedSeed);
  const airport = choose(random, ["KSEA", "KPAE", "KBFI", "KSAC", "KPDX"] as const);
  const day = randomInt(random, 12, 27);
  const hour = randomInt(random, 0, 23);
  const minute = randomInt(random, 0, 11) * 5;
  const windDirection = randomInt(random, 1, 36) * 10;
  const windSpeed = randomInt(random, 5, 24);
  const gust = windSpeed >= 16 && random() > 0.45 ? windSpeed + randomInt(random, 5, 12) : null;
  const visibility = choose(random, [3, 5, 7, 10] as const);
  const cloudCoverage = choose(random, ["FEW", "SCT", "BKN", "OVC"] as const);
  const cloudHundreds = randomInt(random, 12, 65);
  const temperature = randomInt(random, -5, 32);
  const dewPoint = temperature - randomInt(random, 2, 12);
  const altimeterHundredths = randomInt(random, 2972, 3032);
  const kind = choose(
    random,
    ["wind", "visibility", "ceiling", "altimeter", "temperature"] as const,
  );
  const metar = `${airport} ${String(day).padStart(2, "0")}${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}Z ${String(windDirection).padStart(3, "0")}${String(windSpeed).padStart(2, "0")}${gust ? `G${String(gust).padStart(2, "0")}` : ""}KT ${visibility}SM ${cloudCoverage}${String(cloudHundreds).padStart(3, "0")} ${formatSignedTemperature(temperature)}/${formatSignedTemperature(dewPoint)} A${altimeterHundredths}`;

  let prompt: string;
  let correct: string;
  let distractors: string[];
  let explanation: string;
  switch (kind) {
    case "wind":
      prompt = `Decode the wind group in: ${metar}`;
      correct = `From ${windDirection}° at ${windSpeed} kt${gust ? `, gusting ${gust} kt` : ""}`;
      distractors = [
        `To ${windDirection}° at ${windSpeed} kt`,
        `From ${windSpeed}° at ${windDirection} kt`,
        `Variable at ${windSpeed} kt`,
      ];
      explanation = `METAR winds are reported as the direction they come from, followed by speed and an optional G gust value.`;
      break;
    case "visibility":
      prompt = `What visibility is reported in: ${metar}`;
      correct = `${visibility} statute miles`;
      distractors = [`${visibility} nautical miles`, `${visibility / 10} statute miles`, "Visibility unrestricted"];
      explanation = `${visibility}SM reports prevailing visibility in statute miles.`;
      break;
    case "ceiling": {
      prompt = `What ceiling is reported in: ${metar}`;
      const isCeiling = cloudCoverage === "BKN" || cloudCoverage === "OVC";
      correct = isCeiling
        ? `${cloudHundreds * 100} ft AGL`
        : "No reported ceiling";
      distractors = isCeiling
        ? [`${cloudHundreds * 10} ft AGL`, `${cloudHundreds * 100} ft MSL`, "No reported ceiling"]
        : [`${cloudHundreds * 100} ft AGL`, `${cloudHundreds * 10} ft AGL`, `${cloudHundreds * 100} ft MSL`];
      explanation = `${cloudCoverage} means ${cloudCoverage === "BKN" ? "broken" : cloudCoverage === "OVC" ? "overcast" : cloudCoverage === "SCT" ? "scattered" : "few"} at ${cloudHundreds * 100} ft AGL. Only BKN, OVC, and vertical visibility establish a ceiling.`;
      break;
    }
    case "altimeter":
      prompt = `Decode the altimeter setting in: ${metar}`;
      correct = `${(altimeterHundredths / 100).toFixed(2)} inHg`;
      distractors = [
        `${(altimeterHundredths / 10).toFixed(1)} inHg`,
        `${altimeterHundredths} hPa`,
        `${(altimeterHundredths / 100 + 0.1).toFixed(2)} inHg`,
      ];
      explanation = `A${altimeterHundredths} inserts a decimal after the first two digits: ${(altimeterHundredths / 100).toFixed(2)} inches of mercury.`;
      break;
    case "temperature":
      prompt = `Decode temperature and dew point in: ${metar}`;
      correct = `${temperature}°C / ${dewPoint}°C dew point`;
      distractors = [
        `${dewPoint}°C / ${temperature}°C dew point`,
        `${temperature}°F / ${dewPoint}°F dew point`,
        `${temperature - dewPoint}°C / ${dewPoint}°C dew point`,
      ];
      explanation = `The temperature/dew-point group lists temperature first and dew point second; M denotes a value below zero Celsius.`;
      break;
  }

  const shuffled = shuffleAnswerOptions(random, correct, distractors);
  return {
    id: `wx-${seedToUint32(namespacedSeed).toString(16)}`,
    category: "weatherDecoding",
    seed: String(seed),
    metar,
    kind,
    prompt,
    options: shuffled.options,
    correctIndex: shuffled.correctIndex,
    explanation,
  };
}

export function generateCalculationSet(seed: Seed): CalculationPracticeSet {
  return {
    weightAndBalance: generateWeightAndBalance(seed),
    crosswind: generateCrosswind(seed),
    performanceInterpolation: generatePerformanceInterpolation(seed),
    weatherDecoding: generateWeatherDecoding(seed),
  };
}
