import React from 'react';
import { ROIParams, ROIResults } from '../../types';
import { SensitivityRow, dominantDriver } from '../../utils/sensitivity';

const fmtMonths = (m: number | null) =>
  m === null ? 'None' : m === 0 ? 'Now' : `${m.toFixed(1)}`;

/**
 * The assumption set, printed on the report.
 *
 * Working days per year and the energy tariff used to be hardcoded constants
 * invisible to the reader, so two projects priced at different sites looked
 * directly comparable when they were not (P1-06).
 */
export const AssumptionsPanel: React.FC<{ params: ROIParams; results: ROIResults; t?: any }> = ({
  params,
  results,
  t,
}) => {
  const a = results.assumptions;
  const shift = (s: typeof a.current) =>
    `${s.shiftsPerDay} × ${s.hoursPerShift}h = ${s.hoursPerDay}h/day`;

  // Shown per side: the two lines frequently run different shift counts, and a
  // reader comparing cost per pair needs to see that before trusting the ratio.
  const rows: Array<[string, string]> = [
    [t?.shiftCurrent || 'Shift pattern — current', shift(a.current)],
    [t?.shiftProposed || 'Shift pattern — proposed', shift(a.proposed)],
    [t?.workingDays || 'Working days / year', `${a.daysPerYear}`],
    [
      t?.operatingHours || 'Operating hours / year',
      `${a.current.hoursPerYear.toLocaleString()} / ${a.proposed.hoursPerYear.toLocaleString()}`,
    ],
    [t?.energyTariff || 'Energy tariff', `$${a.powerRateUSD.toFixed(4)}/kWh`],
    [t?.laborCost || 'Labour cost', `$${(params.localLaborCost || 0).toLocaleString()}/op/mo`],
    [t?.machineQuantity || 'Stations in scope', `${params.machineQuantity}`],
    [t?.paybackBasis || 'Payback basis', results.investment.basis === 'net' ? 'Net incremental' : 'Gross'],
  ];

  const legacySchedule = a.current.fromLegacy || a.proposed.fromLegacy;

  return (
    <div>
      <h4 className="text-[10px] font-black uppercase tracking-[0.18em] !text-zinc-500 mb-2">
        {t?.assumptions || 'Assumptions'}
      </h4>
      <table className="w-full text-[10px] border-collapse">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="border border-zinc-300 p-1.5 font-medium !text-zinc-600">{label}</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono !text-black">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[9px] !text-zinc-500 mt-1.5 leading-relaxed">
        {t?.assumptionsNote ||
          'Energy tariff and working calendar vary by site. Confirm both before comparing projects across countries.'}
      </p>
      {legacySchedule && (
        <p className="text-[9px] !text-amber-700 mt-1 leading-relaxed font-medium">
          {t?.legacyScheduleNote ||
            'This project has no per-side shift pattern recorded, so both sides use the same working day. If the two lines run different shift counts, set them on the form — the cost-per-pair comparison depends on it.'}
        </p>
      )}
    </div>
  );
};

/**
 * One-variable sensitivity: which input is carrying the result.
 */
export const SensitivityPanel: React.FC<{ rows: SensitivityRow[]; t?: any }> = ({ rows, t }) => {
  const dominant = dominantDriver(rows);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] !text-zinc-500">
          {t?.sensitivity || 'Sensitivity'}
        </h4>
        {dominant && (
          <span className="text-[9px] font-bold uppercase tracking-wider !text-amber-700">
            {t?.dominantDriver || 'Most sensitive to'}: {dominant.label}
          </span>
        )}
      </div>

      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="!bg-zinc-100">
            <th className="border border-zinc-300 p-1.5 text-left font-black uppercase !text-zinc-600">
              {t?.driver || 'Driver'}
            </th>
            <th className="border border-zinc-300 p-1.5 text-right font-black uppercase !text-zinc-600">-20%</th>
            <th className="border border-zinc-300 p-1.5 text-right font-black uppercase !text-zinc-600">
              {t?.base || 'Base'}
            </th>
            <th className="border border-zinc-300 p-1.5 text-right font-black uppercase !text-zinc-600">+20%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="border border-zinc-300 p-1.5 font-medium !text-black">
                {row.label}
                <span className="!text-zinc-400 ml-1 font-mono">({row.unit})</span>
              </td>
              {row.points.map((p) => (
                <td
                  key={p.delta}
                  className={`border border-zinc-300 p-1.5 text-right font-mono tabular-nums ${
                    p.delta === 0 ? 'font-black !text-black !bg-zinc-50' : '!text-zinc-600'
                  }`}
                >
                  {fmtMonths(p.roiMonths)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[9px] !text-zinc-500 mt-1.5 leading-relaxed">
        {t?.sensitivityNote || 'Payback in months. Each driver is flexed alone, holding all others at base.'}
      </p>
    </div>
  );
};
