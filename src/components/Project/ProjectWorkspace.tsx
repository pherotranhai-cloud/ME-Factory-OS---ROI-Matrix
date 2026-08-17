import React from 'react';
import { FileSpreadsheet, ClipboardList, BarChart3, RotateCcw, Save, AlertTriangle, FileText } from 'lucide-react';
import { type ProjectInput } from '../../domain/model';
import { calculateProject } from '../../domain/engine';
import { validateProject, hasBlockingErrors } from '../../domain/validate';
import { newProjectDefaults } from '../../domain/adapt';
import { emma21Project } from '../../domain/fixtures/emma21';
import { ProjectForm } from './ProjectForm';
import { ProjectReport } from './ProjectReport';

/**
 * The analysis workspace: entry on one tab, the report on the other, both fed by
 * a single engine run so they cannot drift apart.
 *
 * Validation is computed once here and passed down, so the same issue appears
 * against the field that caused it and in the report banner — a reviewer reading
 * the report and an engineer fixing the input see the same list.
 */

interface Props {
  value: ProjectInput;
  /**
   * `replaced` marks the project being swapped wholesale rather than edited, so
   * the caller can drop provenance it no longer applies to. Editing a field
   * does not stop a project having been imported; loading a different one does.
   */
  onChange: (next: ProjectInput, opts?: { replaced?: boolean }) => void;
  onExport?: (input: ProjectInput) => void;
  onExportPdf?: (input: ProjectInput) => void;
  onSave?: (input: ProjectInput) => Promise<void>;
  /** True when this project was adapted from a stored legacy report. */
  wasImported?: boolean;
  isSaving?: boolean;
}

export const ProjectWorkspace: React.FC<Props> = ({
  value, onChange, onExport, onExportPdf, onSave, wasImported, isSaving,
}) => {
  const [view, setView] = React.useState<'entry' | 'report'>('entry');

  const issues = React.useMemo(() => validateProject(value), [value]);
  const result = React.useMemo(() => calculateProject(value), [value]);
  const blocked = hasBlockingErrors(issues);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.length - errorCount;

  return (
    <div className="pb-16">
      <div className="max-w-6xl mx-auto mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl overflow-hidden border border-[#006D77]/20">
          {([
            ['entry', 'Data entry', ClipboardList],
            ['report', 'Report', BarChart3],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                view === key ? 'bg-[#006D77] text-white' : 'bg-white/70 text-[#4A6B6F] hover:bg-[#83C5BE]/20'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          {errorCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 border border-red-200 px-2.5 py-1">
              {errorCount} error{errorCount === 1 ? '' : 's'}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1">
              {warningCount} warning{warningCount === 1 ? '' : 's'}
            </span>
          )}
          {issues.length === 0 && (
            <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1">
              Checks pass
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(emma21Project, { replaced: true })}
            title="Load the IE-verified EMMA 21 reference project"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#006D77]/20 bg-white/70 text-[11px] font-bold text-[#4A6B6F] hover:bg-[#83C5BE]/20 transition-colors"
          >
            Load reference
          </button>
          <button
            type="button"
            onClick={() => onChange(newProjectDefaults(), { replaced: true })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#006D77]/20 bg-white/70 text-[11px] font-bold text-[#4A6B6F] hover:bg-[#83C5BE]/20 transition-colors"
          >
            <RotateCcw size={13} /> New
          </button>
          {onSave && (
            <button
              type="button"
              onClick={() => { void onSave(value); }}
              disabled={blocked || isSaving}
              title={blocked ? 'Resolve the blocking errors before saving' : 'Save this project'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#006D77]/20 bg-white/70 text-[11px] font-bold text-[#4A6B6F] hover:bg-[#83C5BE]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={13} /> {isSaving ? 'Saving…' : 'Save'}
            </button>
          )}
          {onExportPdf && (
            <button
              type="button"
              onClick={() => onExportPdf(value)}
              disabled={blocked}
              title={blocked ? 'Resolve the blocking errors before exporting' : 'Export to PDF'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#006D77]/20 bg-white/70 text-[11px] font-bold text-[#4A6B6F] hover:bg-[#83C5BE]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileText size={13} /> PDF
            </button>
          )}
          {onExport && (
            <button
              type="button"
              onClick={() => onExport(value)}
              disabled={blocked}
              title={blocked ? 'Resolve the blocking errors before exporting' : 'Export to Excel'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006D77] text-white text-[11px] font-bold hover:bg-[#005259] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet size={13} /> Export
            </button>
          )}
        </div>
      </div>

      {/*
        An imported project restates: the old engine costed each side at its own
        capacity, this one costs both at a single volume. Saying so up front is
        the difference between a corrected figure and a figure that looks like
        someone changed the numbers.
      */}
      {wasImported && (
        <div className="max-w-6xl mx-auto mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-relaxed text-amber-900">
            <span className="font-bold">Imported from a stored report.</span> Every value you
            entered has carried across unchanged, but the figures below will not match the ones
            originally approved — the old model measured each side at its own output, this one
            measures both at the same volume. Settings the old model implied (fixed fleet,
            headcount labour, depreciation in operating cost, no efficiency or downtime
            allowance) are carried over as-is; the warnings above say what they cost.
          </p>
        </div>
      )}

      {view === 'entry'
        ? <ProjectForm value={value} onChange={onChange} issues={issues} />
        : <ProjectReport result={result} issues={issues} />}
    </div>
  );
};
