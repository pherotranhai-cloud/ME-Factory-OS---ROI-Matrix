import React from 'react';
import { ProjectInput, SideInput } from '../../domain/model';
import { Issue } from '../../domain/validate';
import { calculateProject } from '../../domain/engine';
import { Field, Toggle, Section, IssueBanner, issuesFor } from './Fields';

/**
 * Project data entry.
 *
 * Laid out to make the two distinctions that previously went wrong impossible to
 * miss: machine cycle time sits directly beside labour cycle time with the
 * difference explained, and every derived figure (available hours, units
 * required, implied operators) is shown live under the inputs that produce it,
 * so a value on the wrong scope shows up immediately rather than at report time.
 */

const fmt = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

interface Props {
  value: ProjectInput;
  onChange: (next: ProjectInput) => void;
  issues: Issue[];
}

export const ProjectForm: React.FC<Props> = ({ value, onChange, issues }) => {
  const result = React.useMemo(() => calculateProject(value), [value]);

  const set = <K extends keyof ProjectInput>(key: K, v: ProjectInput[K]) =>
    onChange({ ...value, [key]: v });

  const setSide = (which: 'baseline' | 'proposed', next: SideInput) =>
    onChange({ ...value, [which]: next });

  const sideBlock = (which: 'baseline' | 'proposed') => {
    const side = value[which];
    const r = result[which];
    const m = side.machine;
    const p = `${which}.machine`;

    const patchMachine = (patch: Partial<typeof m>) =>
      setSide(which, { ...side, machine: { ...m, ...patch } });

    return (
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-[#006D77]/20 bg-white/60 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-[#002D32]">
              {which === 'baseline' ? 'Baseline' : 'Proposed'}
            </h4>
            <span className="text-[10px] font-mono text-[#4A6B6F]/70">
              {fmt(r.fleet.units.value)} units · {fmt(r.fleet.capacity.value)} prs/yr
            </span>
          </div>

          <Field
            label="Equipment name" type="text" value={m.name}
            onChange={(v) => patchMachine({ name: v as unknown as string })}
          />

          <div className="grid grid-cols-2 gap-x-3">
            <Field
              label="Machine cycle" value={m.machineCycleSec} step={0.001} suffix="s/pair"
              onChange={(v) => patchMachine({ machineCycleSec: v })}
              issues={issuesFor(issues, `${p}.machineCycleSec`)}
              hint="Seconds the MACHINE is occupied per pair. This decides throughput and therefore how many units you need."
              derived={`${fmt(r.fleet.outputPerUnit.value)} prs/yr per unit`}
            />
            <Field
              label="Labour cycle" value={m.labourCycleSec} step={0.001} suffix="s/pair"
              onChange={(v) => patchMachine({ labourCycleSec: v })}
              issues={issuesFor(issues, `${p}.labourCycleSec`)}
              hint="Total OPERATOR seconds per pair, including work running alongside the machine — nesting, QC, de-nesting. Often higher than machine time on automatic equipment."
              derived={
                m.machineCycleSec > 0
                  ? `${(m.labourCycleSec / m.machineCycleSec).toFixed(2)}x machine time`
                  : undefined
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3">
            <Field
              label="Shifts / day" value={side.shift.shiftsPerDay} suffix="shifts"
              onChange={(v) => setSide(which, { ...side, shift: { ...side.shift, shiftsPerDay: v } })}
            />
            <Field
              label="Hours / shift" value={side.shift.hoursPerShift} step={0.5} suffix="h"
              onChange={(v) => setSide(which, { ...side, shift: { ...side.shift, hoursPerShift: v } })}
              derived={`= ${r.schedule.hoursPerDay} h/day · ${fmt(r.schedule.availableSecondsPerYear.value / 3600)} h/yr`}
            />
          </div>

          <Toggle
            label="Fleet size"
            value={side.fleet.mode}
            options={[
              { value: 'derived', label: 'From demand', hint: `Sized from takt time — currently ${fmt(r.fleet.units.value)} units.` },
              { value: 'fixed', label: 'Fixed', hint: 'You set the count. Used when the fleet is already decided.' },
            ]}
            onChange={(mode) =>
              setSide(which, {
                ...side,
                fleet: mode === 'derived' ? { mode: 'derived' } : { mode: 'fixed', units: r.fleet.units.value },
              })
            }
          />
          {side.fleet.mode === 'fixed' && (
            <Field
              label="Units" value={side.fleet.units} suffix="units"
              onChange={(v) => setSide(which, { ...side, fleet: { mode: 'fixed', units: v } })}
              issues={issuesFor(issues, `${which}.fleet.units`)}
              derived={`${(r.fleet.utilisation.value * 100).toFixed(0)}% utilised`}
            />
          )}

          <div className="grid grid-cols-2 gap-x-3">
            <Field
              label="Unit price" value={m.unitPrice} suffix="USD"
              onChange={(v) => patchMachine({ unitPrice: v })}
              derived={`${fmt(r.capex.value)} total`}
            />
            <Field
              label="Operators / unit" value={m.operatorsPerUnit ?? 0} step={0.01} suffix="ops"
              onChange={(v) => patchMachine({ operatorsPerUnit: v })}
              issues={issuesFor(issues, `${p}.operatorsPerUnit`)}
              disabled={value.labour.basis !== 'headcount'}
              hint="Only used on the headcount labour basis. Must describe ONE unit, not a whole line."
              derived={value.labour.basis === 'cycleTime' ? 'not used on the cycle-time basis' : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3">
            <Field
              label="Consumables / yr" value={m.consumablesPerYear} suffix="USD"
              onChange={(v) => patchMachine({ consumablesPerYear: v })}
              hint="Per unit per year. Scaled by the fleet size."
            />
            <Field
              label="Maintenance / yr" value={m.maintenancePerYear} suffix="USD"
              onChange={(v) => patchMachine({ maintenancePerYear: v })}
              hint="Parts per unit per year. Scaled by the fleet size."
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3">
            <Field
              label="Power" value={m.powerKW} step={0.1} suffix="kW"
              onChange={(v) => patchMachine({ powerKW: v })}
            />
            <Field
              label="Downtime loss / yr" value={m.downtimeLossPerYear} suffix="USD"
              onChange={(v) => patchMachine({ downtimeLossPerYear: v })}
              hint="Idle labour cost from unplanned stoppages, for the whole side. Zero means no record exists, which flatters this side."
            />
          </div>

          {value.costBasis === 'fullCost' && (
            <Field
              label="Depreciation period" value={m.depreciationYears} suffix="years"
              onChange={(v) => patchMachine({ depreciationYears: v })}
              issues={issuesFor(issues, `${p}.depreciationYears`)}
            />
          )}

          <div className="mt-2 pt-2 border-t border-[#006D77]/10">
            <div className="grid grid-cols-2 gap-x-3">
              <Field
                label={`Material / pair`} value={side.material.consumptionPerPair} step={0.0001}
                suffix={side.material.unit}
                onChange={(v) => setSide(which, { ...side, material: { ...side.material, consumptionPerPair: v } })}
                issues={issuesFor(issues, `${which}.material.consumptionPerPair`)}
                hint="Consumption per pair. This is usually the largest cost line and the one that decides the case."
              />
              <Field
                label="Material price" value={side.material.pricePerUnit} step={0.01}
                suffix={`USD/${side.material.unit}`}
                onChange={(v) => setSide(which, { ...side, material: { ...side.material, pricePerUnit: v } })}
                issues={issuesFor(issues, `${which}.material.pricePerUnit`)}
                derived={`${(side.material.consumptionPerPair * side.material.pricePerUnit).toFixed(4)} USD/pair`}
              />
            </div>
            <Field
              label="Yield" value={(side.yieldRate ?? 1) * 100} step={0.1} suffix="%"
              onChange={(v) => setSide(which, { ...side, yieldRate: (v as unknown as number) / 100 })}
              hint="Share of produced pairs that are saleable. Leave at 100% when scrap is already embedded in the material consumption above, or it will be counted twice."
              derived={
                (side.yieldRate ?? 1) < 1
                  ? `must produce ${fmt(r.fleet.grossPairsRequired.value)} to deliver ${fmt(value.demandPairsPerYear)}`
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4"><IssueBanner issues={issues} /></div>

      <Section title="Project">
        <div className="grid grid-cols-3 gap-x-4">
          <Field label="Project name" type="text" value={value.projectName} onChange={(v) => set('projectName', v as unknown as string)} />
          <Field label="Article" type="text" value={value.article} onChange={(v) => set('article', v as unknown as string)} />
          <Field label="Date" type="text" value={value.date} onChange={(v) => set('date', v as unknown as string)} />
        </div>
        <Field
          label="Annual demand" value={value.demandPairsPerYear} suffix="pairs/yr"
          onChange={(v) => set('demandPairsPerYear', v)}
          issues={issuesFor(issues, 'demandPairsPerYear')}
          hint="The volume this proposal must serve. Both sides are costed at this figure, and equipment is sized to deliver it."
        />
      </Section>

      <Section title="Basis" note="these choices change the answer materially">
        <div className="grid grid-cols-2 gap-x-4">
          <Toggle
            label="Labour basis"
            value={value.labour.basis}
            options={[
              { value: 'cycleTime', label: 'Cycle time', hint: 'Labour = labour seconds per pair x volume x hourly rate. Scales with output.' },
              { value: 'headcount', label: 'Headcount', hint: 'Labour = operators per unit x units x wage. Fixed once staffed. Check manning is stated per machine.' },
            ]}
            onChange={(basis) => set('labour', { ...value.labour, basis })}
          />
          <Toggle
            label="Cost basis"
            value={value.costBasis}
            options={[
              { value: 'cash', label: 'Cash', hint: 'Depreciation excluded; capital recovered through payback. Matches an IE investment case.' },
              { value: 'fullCost', label: 'Full cost', hint: 'Depreciation charged into operating cost. Gives a true unit cost, but do not also read payback off the capital.' },
            ]}
            onChange={(costBasis) => set('costBasis', costBasis)}
          />
        </div>
      </Section>

      <Section title="Calendar & operating time">
        <div className="grid grid-cols-4 gap-x-3">
          <Field
            label="Working days / yr" value={value.calendar.daysPerYear} suffix="days"
            onChange={(v) => set('calendar', { ...value.calendar, daysPerYear: v })}
            issues={issuesFor(issues, 'calendar.daysPerYear')}
          />
          <Field
            label="Line efficiency" value={value.calendar.lineEfficiency} step={0.0001}
            onChange={(v) => set('calendar', { ...value.calendar, lineEfficiency: v })}
            issues={issuesFor(issues, 'calendar.lineEfficiency')}
            hint="Performance x quality, as a fraction. From the OEE report. 1.0 means nameplate capacity, which understates the fleet you need."
          />
          <Field
            label="Downtime allowance" value={value.calendar.downtimeAllowance} step={0.0001}
            onChange={(v) => set('calendar', { ...value.calendar, downtimeAllowance: v })}
            issues={issuesFor(issues, 'calendar.downtimeAllowance')}
            hint="Unplanned downtime as a fraction of available time."
          />
          <Field
            label="Energy tariff" value={value.energyTariffUSDPerKWh} step={0.001} suffix="USD/kWh"
            onChange={(v) => set('energyTariffUSDPerKWh', v)}
          />
        </div>
      </Section>

      <Section title="Labour">
        <div className="grid grid-cols-4 gap-x-3">
          <Field
            label="Monthly wage" value={value.labour.monthlyWage} suffix="USD"
            onChange={(v) => set('labour', { ...value.labour, monthlyWage: v })}
            issues={issuesFor(issues, 'labour.monthlyWage')}
            hint="Fully loaded, per operator per month."
          />
          <Field
            label="Paid hours / month" value={value.labour.paidHoursPerMonth} suffix="h"
            onChange={(v) => set('labour', { ...value.labour, paidHoursPerMonth: v })}
            issues={issuesFor(issues, 'labour.paidHoursPerMonth')}
            hint="Turns the monthly wage into an hourly rate, so manning can be reconciled against shift coverage."
            derived={
              value.labour.paidHoursPerMonth > 0
                ? `${(value.labour.monthlyWage / value.labour.paidHoursPerMonth).toFixed(4)} USD/hr`
                : undefined
            }
          />
          <Field
            label="Labour conversion" value={value.labour.conversionFactor} step={0.05}
            onChange={(v) => set('labour', { ...value.labour, conversionFactor: v })}
            issues={issuesFor(issues, 'labour.conversionFactor')}
            hint="Share of the theoretical labour saving actually banked as headcount, 0–1."
          />
          <Field
            label="Horizon" value={value.horizonYears} suffix="years"
            onChange={(v) => set('horizonYears', v)}
          />
        </div>
      </Section>

      <Section title="Equipment" note="machine time sizes the fleet; labour time carries the cost">
        <div className="flex gap-4">
          {sideBlock('baseline')}
          {sideBlock('proposed')}
        </div>
      </Section>
    </div>
  );
};
