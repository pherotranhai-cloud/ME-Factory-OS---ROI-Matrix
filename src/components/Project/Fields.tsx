import React from 'react';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import { type Issue } from '../../domain/validate';

/**
 * Form primitives for the project editor.
 *
 * Two things every field here can do that the previous form could not:
 * carry a `hint` explaining what the number means and where it comes from, and
 * surface the validation issues raised against it. Both exist because the
 * costliest mistake this tool has made was a perfectly valid number entered
 * against the wrong scope, which no type could have caught.
 */

export const issuesFor = (issues: Issue[], field: string): Issue[] =>
  issues.filter((i) => i.field === field);

const severityRing = (issues: Issue[]): string => {
  if (issues.some((i) => i.severity === 'error')) return 'border-red-400 focus:border-red-500';
  if (issues.length > 0) return 'border-amber-400 focus:border-amber-500';
  return 'border-[#006D77]/20 focus:border-[#006D77]';
};

export const IssueList: React.FC<{ issues: Issue[] }> = ({ issues }) => {
  if (issues.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {issues.map((i) => (
        <div
          key={i.code}
          className={`flex items-start gap-1.5 text-[10px] leading-snug ${
            i.severity === 'error' ? 'text-red-700' : 'text-amber-700'
          }`}
        >
          {i.severity === 'error'
            ? <XCircle size={11} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={11} className="mt-0.5 shrink-0" />}
          <span>
            {i.message} <span className="opacity-75">{i.remedy}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

interface FieldProps {
  label: string;
  value: number | string;
  onChange: (v: never) => void;
  /** What the number means and where it should come from. */
  hint?: string;
  suffix?: string;
  issues?: Issue[];
  type?: 'number' | 'text';
  step?: number;
  /** Derived value shown beneath, e.g. "= 22.5 h/day". */
  derived?: string;
  disabled?: boolean;
}

export const Field: React.FC<FieldProps> = ({
  label, value, onChange, hint, suffix, issues = [], type = 'number', step, derived, disabled,
}) => (
  <div className="mb-3">
    <div className="flex items-center gap-1.5 mb-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B6F]">{label}</label>
      {hint && (
        <span className="group relative inline-flex">
          <Info size={11} className="text-[#006D77]/40 cursor-help hover:text-[#006D77]" />
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 p-2 bg-[#002124] text-white rounded-lg text-[10px] leading-snug opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
            {hint}
          </span>
        </span>
      )}
    </div>
    <div className="relative">
      <input
        type={type}
        step={step}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) =>
          onChange((type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value) as never)
        }
        className={`w-full bg-white/70 border rounded-lg px-3 py-1.5 text-sm text-[#002D32] outline-none transition-colors disabled:opacity-50 ${severityRing(issues)}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#4A6B6F]/70 font-mono pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
    {derived && <div className="mt-1 text-[10px] font-mono text-[#4A6B6F]/70">{derived}</div>}
    <IssueList issues={issues} />
  </div>
);

interface ToggleProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint: string }>;
  onChange: (v: T) => void;
}

export function Toggle<T extends string>({ label, value, options, onChange }: ToggleProps<T>) {
  const active = options.find((o) => o.value === value);
  return (
    <div className="mb-3">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4A6B6F] mb-1">{label}</label>
      <div className="flex rounded-lg overflow-hidden border border-[#006D77]/20">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 px-3 py-1.5 text-[11px] font-bold transition-colors ${
              o.value === value
                ? 'bg-[#006D77] text-white'
                : 'bg-white/70 text-[#4A6B6F] hover:bg-[#83C5BE]/20'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {/* The consequence of the choice, not just its name — these toggles change
          the answer materially and the reader should see how. */}
      {active && <div className="mt-1 text-[10px] text-[#4A6B6F]/80 leading-snug">{active.hint}</div>}
    </div>
  );
}

export const Section: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({
  title, note, children,
}) => (
  <section className="mb-6">
    <div className="flex items-baseline justify-between border-b border-[#006D77]/15 pb-1.5 mb-3">
      <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-[#006D77]">{title}</h3>
      {note && <span className="text-[10px] text-[#4A6B6F]/70">{note}</span>}
    </div>
    {children}
  </section>
);

/** Errors and warnings that are not tied to one field. */
export const IssueBanner: React.FC<{ issues: Issue[] }> = ({ issues }) => {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-[11px] text-emerald-800 font-medium">
        All validation checks pass.
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-[11px] font-medium ${
        errors.length > 0
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-amber-300 bg-amber-50 text-amber-800'
      }`}
    >
      {errors.length > 0 ? (
        <>
          <strong>{errors.length} issue{errors.length === 1 ? '' : 's'} must be resolved</strong> before these figures
          can be relied on{warnings.length > 0 ? `, and ${warnings.length} warning${warnings.length === 1 ? '' : 's'} need review` : ''}.
        </>
      ) : (
        <>
          <strong>{warnings.length} warning{warnings.length === 1 ? '' : 's'}</strong> — the figures compute, but read
          these before presenting them.
        </>
      )}
    </div>
  );
};
