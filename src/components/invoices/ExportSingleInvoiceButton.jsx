'use client';

// ─────────────────────────────────────────────────────────────────
// ExportSingleInvoiceButton — Export a single verified invoice to CSV
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Download, Loader2 } from 'lucide-react';

export default function ExportSingleInvoiceButton({ invoiceId, invoiceNumber }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/export`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to download invoice CSV.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeNumber = (invoiceNumber || invoiceId.slice(-6)).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `invoice-${safeNumber}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Download error:', err);
      alert('Network error while downloading CSV.');
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
      title="Export this verified invoice to CSV"
      className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
    >
      <Download className="w-3.5 h-3.5 mr-1" />
      Export CSV
    </Button>
  );
}
