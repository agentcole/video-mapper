import React from 'react';

// Numeric input with a short label that commits parseable values as you type
export const NumberField: React.FC<{
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  title?: string;
}> = ({ label, value, onCommit, step = 1, title }) => (
  <label className="flex items-center gap-1 text-[11px] text-gray-400" title={title}>
    <span className="w-4 shrink-0">{label}</span>
    <input
      type="number"
      value={Math.round(value * 100) / 100}
      step={step}
      aria-label={title ?? label}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onCommit(n);
      }}
      className="w-full min-w-0 bg-white/10 rounded px-1.5 py-1 text-xs text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400"
    />
  </label>
);
