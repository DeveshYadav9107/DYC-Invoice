'use client';

// ─────────────────────────────────────────────────────────────────
// ExportAllValidatedButton — Export all verified invoices in the list
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Download } from 'lucide-react';

export default function ExportAllValidatedButton({ invoiceIds, count }) {
  const router = useRouter();
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
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: invoiceIds || [] }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to export invoices.');
        return;
      }

      // Download immediately
      window.location.href = `/api/exports/${data.batch.id}/download`;
      router.refresh();
    } catch (err) {
      console.error('Batch export error:', err);
      alert('Network error while exporting invoices.');
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
