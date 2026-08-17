import React, { useState, useEffect } from 'react';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/auth';

export const ReportHistory = ({ lang, t, onEditReport, refreshTrigger }: any) => {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('roi_reports')
            .select('*')
            .order('created_at', { ascending: false });
            
          if (error) {
            console.warn('Supabase fetch failed, falling back to API', error);
            // Fallback
            throw new Error('Fallback');
          } else {
            setReports(data || []);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        // API fallback
        apiFetch('/roi-reports')
          .then(res => res.json())
          .then(data => {
            setReports(Array.isArray(data) ? data : []);
            setIsLoading(false);
          })
          .catch(e => {
            console.error(e);
            setIsLoading(false);
          });
      }
    };
    
    fetchReports();
  }, [refreshTrigger]);

  const handleEdit = (report: any) => {
    onEditReport(report);
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  if (isLoading) return <div className="p-8 max-w-7xl mx-auto text-[#4A6B6F]">Loading history logs...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-[#002D32] mb-6">{t.history || 'History Logs'}</h2>
      <div className="bg-white/80 border border-[#006D77]/20 rounded-2xl overflow-hidden backdrop-blur-[16px] shadow-[0_8px_32px_rgba(0,109,119,0.1)]">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#006D77]/10 border-b border-[#006D77]/10">
              <th className="px-6 py-4 text-[10px] font-semibold uppercase text-[#002D32] tracking-wider">Project ID</th>
              <th className="px-6 py-4 text-[10px] font-semibold uppercase text-[#002D32] tracking-wider">Machine</th>
              <th className="px-6 py-4 text-[10px] font-semibold uppercase text-[#002D32] tracking-wider">Vendor</th>
              <th className="px-6 py-4 text-[10px] font-semibold uppercase text-[#002D32] tracking-wider">Status</th>
              <th className="px-6 py-4 text-[10px] font-semibold uppercase text-[#002D32] tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[#4A6B6F] text-sm italic">
                  No ROI reports found in history. Create one to see it here.
                </td>
              </tr>
            ) : (
              reports.map(r => (
                <tr key={r.id} className="border-b border-[#006D77]/10 bg-white/70 backdrop-blur-md hover:bg-[#006D77]/5 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-[#006D77]">{r.project_id || r.id}</td>
                  <td className="px-6 py-4 text-sm text-[#002D32] font-medium">{r.machine_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-[#4A6B6F]">{r.vendor || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${getStatusColor(r.status)}`}>
                      {r.status || 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <button onClick={() => handleEdit(r)} className="text-[#4A6B6F] hover:text-[#006D77] transition-colors" title="View / Edit">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => handleEdit(r)} className="text-[#4A6B6F] hover:text-amber-600 transition-colors" title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className="text-[#4A6B6F] hover:text-rose-600 transition-colors" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
