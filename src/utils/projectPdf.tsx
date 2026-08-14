import React from 'react';
import { createRoot } from 'react-dom/client';
import html2pdf from 'html2pdf.js';
import { ProjectInput, ProjectResult } from '../domain/model';
import { calculateProject } from '../domain/engine';
import { validateProject } from '../domain/validate';
import { Issue } from '../domain/validate';
import { ProjectReport } from '../components/Project/ProjectReport';

/**
 * PDF from the same component the screen renders.
 *
 * The old PDF had its own template reading the legacy results, which is how a
 * project could show one payback on screen and another on paper. This renders
 * `ProjectReport` — the exact component behind the on-screen report — into an
 * off-screen container in printable mode and prints that. There is no second
 * transcription of the numbers to drift.
 *
 * The cover block carries the settings that decide what the figures mean. A
 * cash-basis payback and a full-cost one are different claims about the same
 * project, and a reader holding the paper has no other way to tell which they
 * are looking at.
 */

/**
 * html2pdf.js ships declarations that omit `pagebreak`, though the library has
 * supported it since 0.9. Declaring the options separately keeps every key
 * type-checked — an `as any` on the object would hide a misspelt key just as
 * effectively as it hides this gap — and excess-property checking does not
 * apply once the value is passed by reference rather than as a literal.
 */
interface PdfOptions {
  margin: [number, number, number, number];
  filename: string;
  image: { type: 'jpeg' | 'png' | 'webp'; quality: number };
  html2canvas: { scale: number; useCORS: boolean; backgroundColor: string };
  jsPDF: { unit: string; format: string; orientation: 'portrait' | 'landscape' };
  pagebreak: { mode: string[]; avoid: string[] };
}

const basisNote = (input: ProjectInput): string =>
  input.costBasis === 'cash'
    ? 'Cash basis — depreciation excluded from operating cost; capital recovered through payback'
    : 'Full-cost basis — depreciation charged into operating cost';

const labourNote = (input: ProjectInput): string =>
  input.labour.basis === 'cycleTime'
    ? 'Labour from cycle time × volume at the hourly rate'
    : 'Labour from headcount × units × monthly wage';

const Cover: React.FC<{ result: ProjectResult }> = ({ result }) => {
  const i = result.input;
  const rows: Array<[string, string]> = [
    ['Article', i.article || '—'],
    ['Date', i.date],
    ['Annual demand', `${Math.round(i.demandPairsPerYear).toLocaleString()} pairs`],
    ['Calendar', `${i.calendar.daysPerYear} days/yr · efficiency ${(i.calendar.lineEfficiency * 100).toFixed(2)}% · downtime allowance ${(i.calendar.downtimeAllowance * 100).toFixed(2)}%`],
    ['Baseline shift', `${i.baseline.shift.shiftsPerDay} × ${i.baseline.shift.hoursPerShift} h`],
    ['Proposed shift', `${i.proposed.shift.shiftsPerDay} × ${i.proposed.shift.hoursPerShift} h`],
    ['Cost basis', basisNote(i)],
    ['Labour basis', labourNote(i)],
    ['Labour conversion', `${(i.labour.conversionFactor * 100).toFixed(0)}% of the theoretical saving banked`],
    ['Horizon', `${i.horizonYears} years`],
  ];

  return (
    <div className="pdf-block mb-6 rounded-xl border border-[#006D77]/20 bg-white/70 p-5">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#006D77] mb-1">
        Capital expenditure analysis
      </div>
      <h1 className="text-2xl font-black tracking-tight text-[#002D32] mb-4">
        {i.projectName || 'Untitled project'}
      </h1>
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-[#006D77]/10 last:border-0">
              <td className="py-1.5 pr-4 text-[#4A6B6F] whitespace-nowrap align-top w-40">{k}</td>
              <td className="py-1.5 text-[#002D32]">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * No fixed width. html2pdf re-lays-out the clone inside a container sized to the
 * printable page, and an element pinned wider than that container overflows it
 * and is cropped — the right-hand column of every card silently disappears off
 * the page edge. Letting the width come from the container is what makes the
 * layout fit the paper.
 */
const PrintableReport: React.FC<{ result: ProjectResult; issues: Issue[] }> = ({ result, issues }) => (
  <div style={{ width: '100%', padding: '16px', background: '#ffffff' }}>
    <Cover result={result} />
    <ProjectReport result={result} issues={issues} printable />
    <p className="mt-6 text-[9px] text-[#4A6B6F]/70 leading-relaxed">
      Every figure above is computed from the recorded inputs at export time. Where a warning is
      shown, it applies to the figures on this page.
    </p>
  </div>
);

/**
 * Render off-screen, print, tear down.
 *
 * The host is attached to the document rather than detached — html2canvas
 * measures layout, and an element outside the document tree has no layout to
 * measure. Positioning it off the left edge keeps it invisible without
 * `display: none`, which would collapse it to zero height.
 *
 * The element handed to html2pdf is the *inner* node, not the host. html2pdf
 * clones what it is given into its own on-screen container, and a clone that
 * inherits `position: fixed; left: -10000px` sits off-screen inside that
 * container too — html2canvas then captures the empty space where it isn't and
 * emits a blank page. Keeping the off-screen positioning on a wrapper the
 * exporter never sees avoids that entirely.
 */
export const exportProjectToPdf = async (
  input: ProjectInput,
  options: { fileName?: string } = {},
): Promise<void> => {
  const result = calculateProject(input);
  const issues = validateProject(input);

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '900px';
  host.style.background = '#ffffff';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(<PrintableReport result={result} issues={issues} />);
    // One paint so fonts and layout settle before html2canvas measures.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const target = host.firstElementChild as HTMLElement | null;
    if (!target || target.scrollHeight === 0) {
      throw new Error('The report did not render, so there is nothing to print.');
    }

    const safe = (options.fileName || input.projectName || 'ROI_Analysis').replace(/[^\w.-]+/g, '_');
    const opt: PdfOptions = {
      margin: [8, 8, 10, 8],
      filename: `${safe}_${input.date}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.pdf-block', 'tr'] },
    };
    await html2pdf().set(opt).from(target).save();
  } finally {
    // Unmount before removal, or React keeps a root pointed at a detached node.
    root.unmount();
    host.remove();
  }
};
