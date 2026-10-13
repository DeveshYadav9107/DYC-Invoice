'use client';

// ─────────────────────────────────────────────────────────────────
// InvoiceListActions — Header action buttons for invoice list
// (Upload button removed per requirement: page focuses strictly on list and verified exports)
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Download } from 'lucide-react';

export default function InvoiceListActions() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/exports">
        <Button variant="secondary">
          <Download className="w-4 h-4 mr-1.5" />
          Export History
        </Button>
      </Link>
    </div>
  );
}
