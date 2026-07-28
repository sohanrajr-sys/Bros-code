"use client";

import { PARAM_TYPES, type FunctionSignature, type ParamType } from "@/lib/functionSignature";

export function FunctionSignatureEditor({
  value,
  onChange,
  helpText = "Optional. If set, students get a LeetCode-style function stub instead of raw stdin/stdout.",
}: {
  value: FunctionSignature;
  onChange: (next: FunctionSignature) => void;
  helpText?: string;
}) {
  function updateSignature(patch: Partial<FunctionSignature>) {
    onChange({ ...value, ...patch });
  }

  function updateParam(index: number, patch: Partial<{ name: string; type: ParamType }>) {
    onChange({
      ...value,
      params: value.params.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  }

  function addParam() {
    onChange({ ...value, params: [...value.params, { name: "", type: "int" }] });
  }

  function removeParam(index: number) {
    onChange({ ...value, params: value.params.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
      <h2 className="text-sm font-medium text-foreground">Function signature</h2>
      <p className="mt-1 text-xs text-text-muted">
        {helpText}
      </p>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-text-muted">Function name</span>
        <input
          value={value.functionName}
          onChange={(e) => updateSignature({ functionName: e.target.value })}
          placeholder="twoSum"
          className="min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 font-mono text-sm text-foreground sm:max-w-xs"
        />
      </label>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Parameters</span>
          <button
            type="button"
            onClick={addParam}
            className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan"
          >
            Add parameter
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {value.params.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={p.name}
                onChange={(e) => updateParam(i, { name: e.target.value })}
                placeholder="paramName"
                className="min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 font-mono text-sm text-foreground sm:flex-1"
              />
              <select
                value={p.type}
                onChange={(e) => updateParam(i, { type: e.target.value as ParamType })}
                className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground sm:w-40"
              >
                {PARAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {value.params.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParam(i)}
                  className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-text-muted">Return type</span>
        <select
          value={value.returnType}
          onChange={(e) => updateSignature({ returnType: e.target.value as ParamType })}
          className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground sm:max-w-xs"
        >
          {PARAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
