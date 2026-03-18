import React, { useState, useEffect } from 'react';
import { Eye, Edit2 } from 'lucide-react';

export const ReportHistory = ({ lang, t, onEditReport, refreshTrigger }: any) => {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/roi-reports')
      .then(res => res.json())
      .then(data => {
        setReports(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, [refreshTrigger]);

  const handleEdit = (report: any) => {
    onEditReport(report);
  };

  if (isLoading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">{t.history}</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-950/50">
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-zinc-500">Project ID</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-zinc-500">Machine</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-zinc-500">Vendor</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-zinc-500">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.id} className="border-t border-zinc-800">
                <td className="px-6 py-4 text-sm text-zinc-300">{r.project_id}</td>
                <td className="px-6 py-4 text-sm text-zinc-300">{r.machine_name}</td>
                <td className="px-6 py-4 text-sm text-zinc-300">{r.vendor}</td>
                <td className="px-6 py-4 text-sm text-zinc-300">{r.status}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleEdit(r)} className="text-emerald-500 hover:text-emerald-400">
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
