// ─────────────────────────────────────────────────────────────────
// CreateExportButton — Triggers a new CSV export batch
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Button from '../ui/Button';
import { Download } from 'lucide-react';
import api, { request } from '../../api/client';

export default function CreateExportButton({ validatedCount, onExportSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (validatedCount === 0) {
      alert('No validated invoices available to export. Please validate invoices first.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/api/exports', {});
      if (!data?.batch?.id) {
        alert('Failed to generate export batch.');
        return;
      }

      // Download batch file
      const blob = await request(`/api/exports/${data.batch.id}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.batch.fileName || `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      if (onExportSuccess) {
        onExportSuccess(data.batch);
      }
    } catch (err) {
      alert(err.message || 'Network error while generating export.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="primary"
      loading={loading}
      disabled={validatedCount === 0}
      onClick={handleExport}
    >
      <Download className="w-4 h-4 mr-1.5" />
      Export {validatedCount} Validated Invoice{validatedCount === 1 ? '' : 's'}
    </Button>
  );
}
