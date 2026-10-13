'use client';

// ─────────────────────────────────────────────────────────────────
// CreateExportButton — Triggers a new CSV export batch
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Download, Sparkles } from 'lucide-react';

export default function CreateExportButton({ validatedCount }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (validatedCount === 0) {
      alert('No validated invoices available to export. Please validate invoices first.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to generate export batch.');
        return;
      }

      // Download immediately
      window.location.href = `/api/exports/${data.batch.id}/download`;
      router.refresh();
    } catch {
      alert('Network error while generating export.');
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
