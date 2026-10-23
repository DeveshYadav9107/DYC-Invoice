// ─────────────────────────────────────────────────────────────────
// ExportAllValidatedButton — Export all verified invoices in the list
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Button from '../ui/Button';
import { Download } from 'lucide-react';
import api, { request } from '../../api/client';

export default function ExportAllValidatedButton({ invoiceIds = [], count = 0, onExportCompleted }) {
  const [loading, setLoading] = useState(false);

  const handleExportAll = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!count || count === 0) {
      alert('No verified invoices available to export.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/api/exports', { invoiceIds: invoiceIds || [] });
      if (!data?.batch?.id) {
        alert('Failed to generate export batch.');
        return;
      }

      // Download batch CSV
      const blob = await request(`/api/exports/${data.batch.id}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.batch.fileName || `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      if (onExportCompleted) {
        onExportCompleted(data.batch);
      }
    } catch (err) {
      console.error('Batch export error:', err);
      alert(err.message || 'Network error while exporting invoices.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="primary"
      size="sm"
      loading={loading}
      onClick={handleExportAll}
      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
    >
      <Download className="w-3.5 h-3.5 mr-1.5" />
      Export All {count} Verified ({count === 1 ? '1 file' : `${count} files`})
    </Button>
  );
}
