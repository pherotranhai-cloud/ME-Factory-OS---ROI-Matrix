import React from 'react';
import { type ROIResults, type SavingsComponent } from '../../types';

const LABELS: Record<SavingsComponent['key'], string> = {
  labor: 'Labour',
  material: 'Material',
  energy: 'Energy',
  maintenance: 'Maintenance',
  consumables: 'Consumables',
  depreciation: 'Depreciation',
};

const money = (n: number, digits = 4) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(digits)}`;

const annual = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Cost-per-pair bridge: where the saving actually comes from.
 *
 * The engine guarantees these components sum exactly to the headline figure, so
 * the reader can reconcile the total by eye. Bars are scaled against the largest
 * absolute contribution so a single dominant driver is obvious at a glance.
 */
export const CostBridge: React.FC<{ results: ROIResults; t?: any; compact?: boolean }> = ({
  results,
  t,
  compact = false,
}) => {
  const { bridge, fobImpact, totalAnnualSaving } = results.savings;
  const max = Math.max(...bridge.map((c) => Math.abs(c.perPairDelta)), 1e-9);

  return (
    <div className={compact ? '' : 'space-y-3'}>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] !text-zinc-500">
          {t?.costBridge || 'Cost per Pair Bridge'}
        </h4>
        <span className="text-[9px] font-bold uppercase tracking-wider !text-zinc-400">
          {t?.perGoodPair || 'Per good pair'}
        </span>
      </div>

      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="!bg-zinc-100">
            <th className="border border-zinc-300 p-1.5 text-left font-black uppercase !text-zinc-600">
              {t?.costLine || 'Cost Line'}
            </th>
            <th className="border border-zinc-300 p-1.5 text-right font-black uppercase !text-zinc-600">
              {t?.current || 'Current'}
            </th>
            <th className="border border-zinc-300 p-1.5 text-right font-black uppercase !text-zinc-600">
              {t?.proposed || 'Proposed'}
            </th>
            <th className="border border-zinc-300 p-1.5 text-right font-black uppercase !text-zinc-600">
              {t?.delta || 'Delta'}
            </th>
            <th className="border border-zinc-300 p-1.5 text-left font-black uppercase !text-zinc-600 w-[26%]">
              {t?.annualImpact || 'Annual Impact'}
            </th>
          </tr>
        </thead>
        <tbody>
          {bridge.map((c) => {
            const width = (Math.abs(c.perPairDelta) / max) * 100;
            const saving = c.perPairDelta >= 0;
            return (
              <tr key={c.key}>
                <td className="border border-zinc-300 p-1.5 font-medium !text-black">{LABELS[c.key]}</td>
                <td className="border border-zinc-300 p-1.5 text-right font-mono !text-black">
                  {money(c.currentPerPair)}
                </td>
                <td className="border border-zinc-300 p-1.5 text-right font-mono !text-black">
                  {money(c.proposedPerPair)}
                </td>
                <td
                  className="border border-zinc-300 p-1.5 text-right font-mono font-bold"
                  style={{ color: saving ? '#047857' : '#b91c1c' }}
                >
                  {money(c.perPairDelta)}
                </td>
                <td className="border border-zinc-300 p-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${Math.max(width, 2)}%`,
                          backgroundColor: saving ? '#059669' : '#dc2626',
                        }}
                      />
                    </div>
                    <span
                      className="font-mono text-[9px] font-bold tabular-nums whitespace-nowrap"
                      style={{ color: saving ? '#047857' : '#b91c1c' }}
                    >
                      {annual(c.annualDelta)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          <tr className="!bg-zinc-50 font-black">
            <td className="border border-zinc-300 p-1.5 !text-zinc-800">{t?.total || 'Total'}</td>
            <td className="border border-zinc-300 p-1.5 text-right font-mono !text-zinc-800">
              {money(results.current.costPerPair)}
            </td>
            <td className="border border-zinc-300 p-1.5 text-right font-mono !text-zinc-800">
              {money(results.proposed.costPerPair)}
            </td>
            <td
              className="border border-zinc-300 p-1.5 text-right font-mono"
              style={{ color: fobImpact >= 0 ? '#047857' : '#b91c1c' }}
            >
              {money(fobImpact)}
            </td>
            <td
              className="border border-zinc-300 p-1.5 text-right font-mono tabular-nums"
              style={{ color: totalAnnualSaving >= 0 ? '#047857' : '#b91c1c' }}
            >
              {annual(totalAnnualSaving)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="text-[9px] !text-zinc-500 mt-1.5 leading-relaxed">
        {t?.bridgeNote ||
          `Measured at equal output of ${Math.round(results.basisOutput).toLocaleString()} good pairs per year. Components sum exactly to the total.`}
      </p>
    </div>
  );
};
