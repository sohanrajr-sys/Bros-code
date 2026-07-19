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

  const correctPicks = [...selected].filter((id) => correct.has(id)).length;
  const wrongPicks = selected.size - correctPicks;
  const fraction = Math.max(0, correctPicks - wrongPicks) / correct.size;
  return round2(fraction * weight);
}

export function scoreShortAnswerDescriptive(
  textAnswer: string,
  acceptedKeywords: string[],
  weight: number
): number {
  const normalized = textAnswer.toLowerCase();
  const matched = acceptedKeywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
  return matched ? weight : 0;
}
