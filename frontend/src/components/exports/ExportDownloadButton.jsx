// ─────────────────────────────────────────────────────────────────
// ExportDownloadButton — Client-side download button for export batches
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Button from '../ui/Button';
import { Download } from 'lucide-react';
import { request } from '../../api/client';

export default function ExportDownloadButton({ batchId, fileName }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const blob = await request(`/api/exports/${batchId}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `export-batch-${batchId.slice(-6)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Download error:', err);
      alert(err.message || 'Failed to download CSV export.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={handleDownload}
    >
      <Download className="w-3.5 h-3.5 mr-1" />
      Download CSV
    </Button>
  );
}
