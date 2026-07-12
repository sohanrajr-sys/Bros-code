import type { Difficulty } from "@/generated/prisma/enums";

const STYLES: Record<Difficulty, string> = {
  EASY: "bg-mint/15 text-mint",
  MEDIUM: "bg-amber/15 text-amber",
  HARD: "bg-danger/15 text-danger",
};

const LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STYLES[difficulty]}`}
    >
      {LABELS[difficulty]}
    </span>
  );
}
