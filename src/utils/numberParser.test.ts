import { describe, it, expect } from "vitest";
import { normalizeRawPrice, parseNumber, formatARS } from "./numberParser";

describe("numberParser - normalizeRawPrice", () => {
  const cases: Array<[any, number | null]> = [
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1234", 1234.0],
    ["$1.234,56", 1234.56],
    ["ARS 2.500", 2500.0],
    ["-1.234,56", -1234.56],
    ["(1.234,56)", -1234.56],
    ["1.234", 1234.0],
    ["1,234", 1234.0],
    ["474.230,785", 474230.78],
    ["474230,775", 474230.78],
    ["", null],
    [null, null],
    [undefined, null],
    [1234.567, 1234.57],
    ["not a number", null],
  ];

  cases.forEach(([input, expected]) => {
    it(`parses ${JSON.stringify(input)} -> ${String(expected)}`, () => {
      const got = normalizeRawPrice(input);
      if (expected === null) {
        expect(got).toBeNull();
      } else {
        expect(got).toBeCloseTo(expected as number, 2);
      }
    });
  });
});

describe("numberParser - parseNumber (backwards compat)", () => {
  it("returns NaN for invalid values", () => {
    expect(Number.isNaN(parseNumber("not a number"))).toBe(true);
  });

  it("parses valid string to number", () => {
    expect(parseNumber("1.234,56")).toBeCloseTo(1234.56, 2);
  });
});

describe("numberParser - formatARS", () => {
  it("formats positive number with thousands and comma decimal", () => {
    expect(formatARS(344505.41)).toBe("$ 344.505,41");
  });
  it("formats small number", () => {
    expect(formatARS(12.3)).toBe("$ 12,30");
  });
  it("formats negative number", () => {
    expect(formatARS(-1234.5)).toBe("$ -1.234,50");
  });
  it("returns '-' for null/undefined", () => {
    expect(formatARS(null)).toBe("-");
    expect(formatARS(undefined)).toBe("-");
  });
});
