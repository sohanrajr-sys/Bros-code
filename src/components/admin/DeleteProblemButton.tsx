"use client";

export function DeleteProblemButton({ title }: { title: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(`Delete "${title}"? This also removes its test cases and submissions — this can't be undone.`)) {
          e.preventDefault();
        }
      }}
      className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-danger transition-colors hover:border-danger"
    >
      Delete
    </button>
  );
}
