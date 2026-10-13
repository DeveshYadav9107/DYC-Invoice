// ─────────────────────────────────────────────────────────────────
// Exports History Page — View and download generated CSV files
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import CreateExportButton from '@/components/exports/CreateExportButton';
import { formatDate } from '@/lib/utils';
import { Download, FileSpreadsheet, ArrowRight, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Export History — InvoiceFlow',
};

export default async function ExportsPage() {
  const sessionData = await requireSession();
  if (!sessionData || !sessionData.user) {
    return null;
  }
  const user = sessionData.user;
  const orgId = user.organizationId;

  let validatedCount = 0;
  let batches = [];

  if (orgId) {
    const [count, batchList] = await Promise.all([
      prisma.invoice.count({
        where: { organizationId: orgId, validationStatus: 'VALIDATED' },
      }),
      prisma.exportBatch.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    validatedCount = count;
    batches = batchList;
  }

  return (
    <div className="space-y-8">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            CSV Exports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Export validated invoices with sanitization and protection against formula injection.
          </p>
        </div>

        <CreateExportButton validatedCount={validatedCount} />
      </div>

      {/* ─── Ready Status Card ─────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/60 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm flex-shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">
                {validatedCount} Invoice{validatedCount === 1 ? '' : 's'} Ready for Export
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Only invoices with status <span className="font-semibold text-emerald-700">VALIDATED</span> are eligible for CSV export.
              </p>
            </div>
          </div>

          {validatedCount > 0 && (
            <Link href="/invoices?status=VALIDATED">
              <Button variant="secondary" size="sm" icon={ArrowRight}>
                View Validated Invoices
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* ─── Export History Table ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-navy-900">Export History</h3>
          <p className="text-xs text-gray-500 mt-0.5">Chronological record of generated spreadsheets</p>
        </CardHeader>

        <CardBody className="p-0">
          {batches.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FileSpreadsheet}
                title="No CSV exports generated yet"
                description="Once invoices pass validation checks, generate your first clean, spreadsheet-ready CSV export."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-6">Batch ID</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6 text-right">Rows Exported</th>
                    <th className="py-3 px-6">Exported By</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-xs font-semibold text-navy-800">
                        BATCH-{batch.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-gray-600">
                        {formatDate(batch.createdAt, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-6 text-right font-medium text-navy-900">
                        {batch.rowCount}
                      </td>
                      <td className="py-3.5 px-6 text-gray-600 truncate max-w-[150px]">
                        {batch.createdBy?.name || batch.createdBy?.email || 'User'}
                      </td>
                      <td className="py-3.5 px-6">
                        <Badge variant="success" dot size="sm">
                          {batch.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <a
                          href={`/api/exports/${batch.id}/download`}
                          download
                          className="inline-flex"
                        >
                          <Button variant="secondary" size="sm" icon={Download}>
                            Download CSV
                          </Button>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
