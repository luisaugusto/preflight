/// <reference types="jest" />

import {
  generateCalculationSet,
  generateCrosswind,
  generatePerformanceInterpolation,
  generateWeatherDecoding,
  generateWeightAndBalance,
  linearInterpolate,
} from './calculations';

describe('deterministic calculation generators', () => {
  it('generates the same complete practice set for the same seed', () => {
    expect(generateCalculationSet('student-42')).toEqual(generateCalculationSet('student-42'));
    expect(generateCalculationSet('student-42')).not.toEqual(generateCalculationSet('student-43'));
  });

  it('derives loaded CG from total moment and weight', () => {
    const problem = generateWeightAndBalance(7);
    expect(problem.centerOfGravity).toBeCloseTo(problem.totalMoment / problem.totalWeight, 2);
    expect(problem.answer.value).toBeCloseTo(problem.centerOfGravity, 1);
  });

  it('uses the sine of wind angle for crosswind', () => {
    const problem = generateCrosswind(18);
    const expected = problem.windSpeed * Math.sin((problem.angle * Math.PI) / 180);
    expect(problem.crosswindComponent).toBeCloseTo(expected, 1);
    expect(problem.from === 'left' || problem.from === 'right').toBe(true);
  });

  it('linearly interpolates performance table values', () => {
    expect(linearInterpolate(1500, 1000, 2000, 800, 1000)).toBe(900);
    const problem = generatePerformanceInterpolation(22);
    expect(problem.interpolatedDistance).toBe(
      Math.round(
        linearInterpolate(
          problem.targetAltitude,
          problem.lowerAltitude,
          problem.upperAltitude,
          problem.lowerDistance,
          problem.upperDistance,
        ),
      ),
    );
    expect(() => linearInterpolate(1, 0, 0, 10, 20)).toThrow(RangeError);
  });

  it('builds a valid deterministic METAR question', () => {
    const problem = generateWeatherDecoding('wx-1');
    expect(problem.metar).toMatch(/^K[A-Z]{3} /);
    expect(problem.options).toHaveLength(4);
    expect(problem.correctIndex).toBeGreaterThanOrEqual(0);
    expect(problem.correctIndex).toBeLessThan(problem.options.length);
    expect(new Set(problem.options).size).toBe(4);
  });
});
