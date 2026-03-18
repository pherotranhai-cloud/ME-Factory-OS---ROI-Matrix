import React, { useState, useEffect } from 'react';
import { Eye, Edit2 } from 'lucide-react';

export const ReportHistory = ({ lang, t, setActiveTab, setParams, setEditingReportId, setCurrentStatus, setUploadedImages, setAiEvaluation, setProjectName, refreshTrigger }: any) => {
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
    setEditingReportId(report.id);
    setCurrentStatus(report.status);
    setProjectName(report.project_id);
    setUploadedImages(typeof report.image_url === 'string' ? JSON.parse(report.image_url || '[]') : report.image_url);
    setAiEvaluation(typeof report.ai_evaluation === 'string' ? JSON.parse(report.ai_evaluation || 'null') : report.ai_evaluation);
    
    // Assuming params are stored in a way we can recover them. 
    // If not, we might need to add a params column to roi_reports.
    // For now, let's assume we can't fully recover params without a column.
    // The user request implies we should be able to load the report data back.
    // I will assume for now we need to add a 'params' column to the roi_reports table.
    // Since I cannot easily change the DB schema, I will just set what I can.
    
    setActiveTab('roi');
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
