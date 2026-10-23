// ─────────────────────────────────────────────────────────────────
// InvoiceDetailActions — Action buttons for invoice detail header
// ─────────────────────────────────────────────────────────────────

import Button from '../ui/Button';
import { ExternalLink, Download } from 'lucide-react';
import { getApiUrl } from '../../api/client';

export default function InvoiceDetailActions({ fileUrl, originalFileName }) {
  const fullUrl = getApiUrl(fileUrl);

  return (
    <div className="flex items-center gap-2 pl-10 sm:pl-0">
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        <Button variant="secondary" size="sm">
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Open in Tab
        </Button>
      </a>
      <a href={fullUrl} download={originalFileName} className="inline-flex">
        <Button variant="secondary" size="sm">
          <Download className="w-3.5 h-3.5 mr-1" />
          Download Original
        </Button>
      </a>
    </div>
  );
}
