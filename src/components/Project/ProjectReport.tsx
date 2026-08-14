import React from 'react';
import { AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { ProjectResult } from '../../domain/model';
import { Issue } from '../../domain/validate';
import { allScenarios, dominantScenario, materialBreakEven, ScenarioTable } from '../../domain/scenarios';

/**
 * The report.
 *
 * Rendered entirely from the engine result, including the formula strings the
 * engine attached to each figure. Nothing here recomputes anything, which is
 * what makes the screen, the PDF and the workbook incapable of disagreeing —
 * they are three renderings of one calculation rather than three calculations.
 */

const money = (n: number, d = 2) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const count = (n: number, d = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const paybackLabel = (r: ProjectResult): string => {
  switch (r.payback.kind) {
    case 'months': return `${r.payback.months.toFixed(1)} months`;
    case 'immediate': return 'Immediate';
    case 'none': return 'No payback';
  }
};

/**
 * A figure the reader can expand to see the arithmetic behind it.
 *
 * `printable` forces every derivation open and drops the control affordances:
 * paper has no disclosure triangle, and a PDF that hid the arithmetic would
 * defeat the point of tracing it.
 */
const Traced: React.FC<{
  label: string; value: string; formula: string; tone?: 'good' | 'bad'; printable?: boolean;
}> = ({ label, value, formula, tone, printable }) => {
  const [open, setOpen] = React.useState(false);
  const shown = printable || open;
  const valueClass = `font-mono text-[12px] tabular-nums font-semibold ${
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-[#002D32]'
  }`;

  return (
    // A derivation card runs taller than a page, so the card itself cannot be
    // kept whole — but a figure must never be separated from its arithmetic.
    <div className={`border-b border-[#006D77]/10 last:border-0${printable ? ' pdf-block' : ''}`}>
      {printable ? (
        <div className="w-full flex items-center justify-between gap-3 py-2">
          <span className="text-[11px] text-[#4A6B6F]">{label}</span>
          <span className={valueClass}>{value}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-3 py-2 text-left hover:bg-[#83C5BE]/10 transition-colors px-2 -mx-2 rounded"
        >
          <span className="flex items-center gap-1.5 text-[11px] text-[#4A6B6F]">
            <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
            {label}
          </span>
          <span className={valueClass}>{value}</span>
        </button>
      )}
      {shown && (
        <div className={`pb-2 pr-2 -mt-0.5 ${printable ? '' : 'pl-5'}`}>
          <code className="text-[10px] font-mono text-[#4A6B6F]/90 leading-relaxed block bg-[#EDF6F9] rounded px-2 py-1.5">
            {formula}
          </code>
        </div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; note?: string; tone?: 'good' | 'bad' }> = ({
  label, value, note, tone,
}) => (
  <div className="rounded-xl border border-[#006D77]/20 bg-white/70 px-4 py-3">
    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#4A6B6F]/80 mb-1">{label}</div>
    <div
      className={`font-mono text-xl font-bold tabular-nums tracking-tight ${
        tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-[#002D32]'
      }`}
    >
      {value}
    </div>
    {note && <div className="text-[10px] text-[#4A6B6F]/75 mt-0.5 leading-snug">{note}</div>}
  </div>
);

const ScenarioBlock: React.FC<{ table: ScenarioTable; dominant: boolean; printable?: boolean }> = ({
  table, dominant, printable,
}) => (
  <div className={`rounded-xl border border-[#006D77]/20 bg-white/70 p-4${printable ? ' pdf-block' : ''}`}>
    <div className="flex items-baseline justify-between mb-1">
      <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#002D32]">{table.title}</h4>
      {dominant && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
          Most sensitive
        </span>
      )}
    </div>
    <p className="text-[10px] text-[#4A6B6F]/80 mb-2.5 leading-snug">{table.question}</p>
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[9px] uppercase tracking-wider text-[#4A6B6F]/70 border-b border-[#006D77]/15">
            <th className="text-left font-bold py-1">Case</th>
            <th className="text-right font-bold py-1">Annual saving</th>
            <th className="text-right font-bold py-1">Payback</th>
            {table.rows.some((r) => r.fleet) && <th className="text-right font-bold py-1">Fleet</th>}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.label} className={r.isBase ? 'bg-[#EDF6F9] font-bold' : ''}>
              <td className="py-1 text-[#002D32]">
                {r.label}
                <span className="block text-[9px] font-normal text-[#4A6B6F]/70">{r.detail}</span>
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-[#002D32]">{money(r.annualSaving, 0)}</td>
              <td className="py-1 text-right font-mono tabular-nums text-[#002D32]">
                {r.paybackMonths === null ? <span className="text-red-700">None</span> : `${r.paybackMonths.toFixed(1)} mo`}
              </td>
              {table.rows.some((x) => x.fleet) && (
                <td className="py-1 text-right font-mono tabular-nums text-[#4A6B6F]">
                  {r.fleet ? `${r.fleet.baseline} → ${r.fleet.proposed}` : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const ProjectReport: React.FC<{
  result: ProjectResult;
  issues: Issue[];
  /** Render for paper: every derivation expanded, no interactive affordances. */
  printable?: boolean;
}> = ({ result, issues, printable }) => {
  const scenarios = React.useMemo(() => allScenarios(result.input), [result.input]);
  const dominant = React.useMemo(() => dominantScenario(scenarios), [scenarios]);
  const breakEven = React.useMemo(() => materialBreakEven(result.input, 24), [result.input]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const material = result.savings.lines.find((l) => l.key === 'material');
  // html2pdf is told to avoid breaking inside anything carrying this class.
  const block = printable ? ' pdf-block' : '';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Nothing below is trustworthy while a blocking error stands, so say so
          before the reader reaches the numbers. */}
      {errors.length > 0 && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wider mb-2">
            <XCircle size={14} /> These figures are not reliable
          </div>
          <ul className="space-y-1">
            {errors.map((e) => (
              <li key={e.code} className="text-[11px] text-red-800 leading-snug">
                <strong>{e.message}</strong> {e.remedy}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Payback"
          value={paybackLabel(result)}
          tone={result.payback.kind === 'none' ? 'bad' : 'good'}
          note={`on ${money(result.investment.incremental.value, 0)} incremental capital`}
        />
        <Kpi
          label="Net annual saving"
          value={money(result.savings.totalAnnual.value, 0)}
          tone={result.savings.totalAnnual.value >= 0 ? 'good' : 'bad'}
          note={`${money(result.savings.perPair.value, 4)} per pair`}
        />
        <Kpi
          label={`${result.input.horizonYears}-year net benefit`}
          value={money(result.horizonNetBenefit.value, 0)}
          note={`ROI ${result.horizonROI.value.toFixed(2)}x`}
        />
        <Kpi
          label="Fleet"
          value={`${count(result.baseline.fleet.units.value)} → ${count(result.proposed.fleet.units.value)}`}
          note={`at ${count(result.basisOutput.value)} pairs/yr`}
        />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-2">
            <AlertTriangle size={14} /> Read before presenting
          </div>
          <ul className="space-y-1.5">
            {warnings.map((w) => (
              <li key={w.code} className="text-[11px] text-amber-900 leading-snug">
                <strong>{w.message}</strong> <span className="opacity-80">{w.remedy}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {material && material.share > 0.5 && (
        <div className="rounded-xl border-l-4 border-[#006D77] border border-[#006D77]/20 bg-white/70 px-4 py-3">
          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#006D77] mb-1">The decisive line</div>
          <p className="text-[12px] text-[#002D32] leading-relaxed">
            <strong>{pct(material.share)} of the saving is material.</strong> Due diligence belongs on the
            consumption measurement, not the headcount.
            {breakEven && (
              <> Payback stays inside 24 months on {pct(breakEven.share, 0)} of the measured gain
                ({breakEven.gain.toFixed(4)} {result.input.proposed.material.unit}/pair).</>
            )}
          </p>
        </div>
      )}

      <div className={`rounded-xl border border-[#006D77]/20 bg-white/70 p-4${block}`}>
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#002D32] mb-1">
          Annual operating cost
        </h3>
        <p className="text-[10px] text-[#4A6B6F]/80 mb-3">
          Both sides at {count(result.basisOutput.value)} pairs/yr.
          {printable ? ' Each figure is shown with the arithmetic behind it.' : ' Click any figure to see its arithmetic.'}
          {result.investment.basis === 'cash' && ' Depreciation is excluded — capital is recovered through the payback above.'}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-[#4A6B6F]/70 border-b border-[#006D77]/20">
                <th className="text-left font-bold py-1.5">Cost line</th>
                <th className="text-right font-bold py-1.5">{result.baseline.label}</th>
                <th className="text-right font-bold py-1.5">{result.proposed.label}</th>
                <th className="text-right font-bold py-1.5">Saving</th>
                <th className="text-right font-bold py-1.5">Share</th>
              </tr>
            </thead>
            <tbody>
              {result.savings.lines.map((l) => (
                <tr key={l.key} className="border-b border-[#006D77]/8">
                  <td className="py-1.5 text-[#002D32]">{l.label}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-[#4A6B6F]">{money(l.baselineAnnual, 0)}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-[#4A6B6F]">{money(l.proposedAnnual, 0)}</td>
                  <td className={`py-1.5 text-right font-mono tabular-nums font-semibold ${l.annualDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {money(l.annualDelta, 0)}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-[#4A6B6F]/70">{pct(l.share, 0)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-[#EDF6F9]">
                <td className="py-1.5 text-[#002D32]">Total</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-[#002D32]">{money(result.baseline.totalAnnual.value, 0)}</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-[#002D32]">{money(result.proposed.totalAnnual.value, 0)}</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-emerald-700">{money(result.savings.totalAnnual.value, 0)}</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-[#4A6B6F]/70">100%</td>
              </tr>
              <tr className="font-bold">
                <td className="py-1.5 text-[#002D32]">Cost per pair</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-[#002D32]">{money(result.baseline.costPerPair.value, 4)}</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-[#002D32]">{money(result.proposed.costPerPair.value, 4)}</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-emerald-700">{money(result.savings.perPair.value, 4)}</td>
                <td className="py-1.5" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Stacked for print. A multi-column CSS grid cannot be paginated: when a
          card is too tall for the remaining page, the break moves that one cell
          and leaves its row-mate stranded beside an empty column. */}
      <div className={printable ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
        {(['baseline', 'proposed'] as const).map((which) => {
          const s = result[which];
          return (
            <div key={which} className="rounded-xl border border-[#006D77]/20 bg-white/70 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#002D32] mb-2">
                {s.label} — how it was derived
              </h3>
              <Traced printable={printable} label="Available time per unit" value={`${count(s.schedule.availableSecondsPerYear.value / 3600)} h/yr`} formula={s.schedule.availableSecondsPerYear.formula} />
              <Traced printable={printable} label="Output per unit" value={`${count(s.fleet.outputPerUnit.value)} prs/yr`} formula={s.fleet.outputPerUnit.formula} />
              <Traced printable={printable} label="Units required" value={count(s.fleet.units.value)} formula={s.fleet.units.formula} />
              <Traced printable={printable} label="Pairs to produce" value={count(s.fleet.grossPairsRequired.value)} formula={s.fleet.grossPairsRequired.formula} />
              <Traced printable={printable} label="Operators implied" value={s.operators.value.toFixed(1)} formula={s.operators.formula} />
              <Traced printable={printable} label="Capital" value={money(s.capex.value, 0)} formula={s.capex.formula} />
              {s.lines.map((l) => (
                <Traced printable={printable} key={l.key} label={l.label} value={money(l.annual.value, 0)} formula={l.annual.formula} />
              ))}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#002D32]">
          How much margin is there
        </h3>
        <div className={printable ? 'space-y-4' : 'grid lg:grid-cols-3 gap-4'}>
          {scenarios.map((t) => (
            <ScenarioBlock key={t.key} table={t} dominant={dominant?.key === t.key} printable={printable} />
          ))}
        </div>
      </div>
    </div>
  );
};
