'use client';

// ─────────────────────────────────────────────────────────────────
// DashboardActions — Client-side action buttons for the dashboard header
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Upload, Download } from 'lucide-react';

export default function DashboardActions() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/invoices/upload">
        <Button variant="primary">
          <Upload className="w-4 h-4 mr-1.5" />
          Upload Invoice
        </Button>
      </Link>
      <Link href="/exports">
        <Button variant="secondary">
          <Download className="w-4 h-4 mr-1.5" />
          Export CSV
        </Button>
      </Link>
    </div>
  );
}
