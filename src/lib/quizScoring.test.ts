import { describe, it, expect } from "vitest";
import { scoreMcq, scoreShortAnswerDescriptive, effectiveScore, weightsSumTo100 } from "./quizScoring";

describe("scoreMcq — ALL_OR_NOTHING", () => {
  it("awards full weight when the selected set exactly matches the correct set", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b"],
      correctOptionIds: ["b", "a"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(20);
  });

  it("awards zero on a partial match", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a"],
      correctOptionIds: ["a", "b"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(0);
  });

  it("awards zero when an extra wrong option is selected", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b", "c"],
      correctOptionIds: ["a", "b"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(0);
  });

  it("awards zero when nothing is selected", () => {
    const score = scoreMcq({
      selectedOptionIds: [],
      correctOptionIds: ["a"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(0);
  });
});

describe("scoreMcq — PROPORTIONAL", () => {
  it("awards full weight for an exact match", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b"],
      correctOptionIds: ["a", "b"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(30);
  });

  it("awards partial credit for a partial match (2 of 3 correct)", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b"],
      correctOptionIds: ["a", "b", "c"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(20); // 2/3 * 30
  });

  it("subtracts wrong picks from the credit", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b", "wrong"],
      correctOptionIds: ["a", "b", "c"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(10); // (2 correct - 1 wrong) / 3 * 30
  });

  it("floors at zero when wrong picks outweigh correct ones", () => {
    const score = scoreMcq({
      selectedOptionIds: ["wrong1", "wrong2", "wrong3"],
      correctOptionIds: ["a"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a"],
      correctOptionIds: ["a", "b", "c"],
      scoringMode: "PROPORTIONAL",
      weight: 10,
    });
    expect(score).toBe(3.33); // 1/3 * 10 = 3.333...
  });

  it("returns zero when there are no correct options to compare against", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a"],
      correctOptionIds: [],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(0);
  });
});

describe("scoreShortAnswerDescriptive", () => {
  it("awards full weight on a case-insensitive keyword match", () => {
    const score = scoreShortAnswerDescriptive("The answer is O(log n)", ["o(log n)"], 15);
    expect(score).toBe(15);
  });

  it("matches any one of several accepted keywords", () => {
    const score = scoreShortAnswerDescriptive("binary search tree", ["bst", "binary search tree"], 15);
    expect(score).toBe(15);
  });

  it("awards zero when no keyword matches", () => {
    const score = scoreShortAnswerDescriptive("linked list", ["array", "hash map"], 15);
    expect(score).toBe(0);
  });

  it("awards zero on an empty answer", () => {
    const score = scoreShortAnswerDescriptive("", ["anything"], 15);
    expect(score).toBe(0);
  });
});

describe("effectiveScore", () => {
  it("uses the override when present, even if it's zero", () => {
    expect(effectiveScore(10, 0)).toBe(0);
  });

  it("falls back to autoScore when there's no override", () => {
    expect(effectiveScore(10, null)).toBe(10);
  });

  it("falls back to zero when neither is set", () => {
    expect(effectiveScore(null, null)).toBe(0);
  });
});

describe("weightsSumTo100", () => {
  it("is true when weights sum to exactly 100", () => {
    expect(weightsSumTo100([50, 30, 20])).toBe(true);
  });

  it("is false when weights sum to anything else", () => {
    expect(weightsSumTo100([50, 30, 19])).toBe(false);
    expect(weightsSumTo100([50, 30, 21])).toBe(false);
  });

  it("is false for an empty question list", () => {
    expect(weightsSumTo100([])).toBe(false);
  });

  it("tolerates float drift from summing non-integer weights", () => {
    expect(weightsSumTo100([30.22, 61.36, 5.96, 2.3, 0.02, 0.14])).toBe(true);
  });
});
