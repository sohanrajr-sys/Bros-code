import { describe, it, expect } from "vitest";
import { scoreMcq } from "./quizScoring";

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
