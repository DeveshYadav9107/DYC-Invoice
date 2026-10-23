// ─────────────────────────────────────────────────────────────────
// DashboardActions — Action buttons for the dashboard header
// ─────────────────────────────────────────────────────────────────

import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import { Upload, Download } from 'lucide-react';

export default function DashboardActions() {
  return (
    <div className="flex items-center gap-3">
      <Link to="/invoices/upload">
        <Button variant="primary">
          <Upload className="w-4 h-4 mr-1.5" />
          Upload Invoice
        </Button>
      </Link>
      <Link to="/exports">
        <Button variant="secondary">
          <Download className="w-4 h-4 mr-1.5" />
          Export CSV
        </Button>
      </Link>
    </div>
  );
}
