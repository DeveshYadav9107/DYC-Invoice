'use client';

// ─────────────────────────────────────────────────────────────────
// ExportDownloadButton — Client-side download button for export batches
// ─────────────────────────────────────────────────────────────────

import Button from '@/components/ui/Button';
import { Download } from 'lucide-react';

export default function ExportDownloadButton({ batchId }) {
  return (
    <a
      href={`/api/exports/${batchId}/download`}
      download
      className="inline-flex"
    >
      <Button variant="secondary" size="sm">
        <Download className="w-3.5 h-3.5 mr-1" />
        Download CSV
      </Button>
    </a>
  );
}
