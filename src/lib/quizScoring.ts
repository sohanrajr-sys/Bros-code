export type McqScoringMode = "ALL_OR_NOTHING" | "PROPORTIONAL";

export interface McqScoreInput {
  selectedOptionIds: string[];
  correctOptionIds: string[];
  scoringMode: McqScoringMode;
  weight: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function scoreMcq(input: McqScoreInput): number {
  const { selectedOptionIds, correctOptionIds, scoringMode, weight } = input;
  const selected = new Set(selectedOptionIds);
  const correct = new Set(correctOptionIds);

  if (scoringMode === "ALL_OR_NOTHING") {
    const exactMatch =
      selected.size === correct.size && [...selected].every((id) => correct.has(id));
    return exactMatch ? weight : 0;
  }

  // PROPORTIONAL — implemented in Task 4
  return 0;
}
