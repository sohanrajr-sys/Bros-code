export type ProblemStatus = "solved" | "attempted";

const STYLES: Record<ProblemStatus, string> = {
  solved: "bg-mint/15 text-mint",
  attempted: "bg-amber/15 text-amber",
};

const LABELS: Record<ProblemStatus, string> = {
  solved: "✓ Solved",
  attempted: "Attempted",
};

export function StatusBadge({ status }: { status: ProblemStatus | undefined }) {
  if (!status) return <span className="text-xs text-text-muted/50">—</span>;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
