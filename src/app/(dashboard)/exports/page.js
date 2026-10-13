// ─────────────────────────────────────────────────────────────────
// Exports History Page — View and download generated CSV files
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import CreateExportButton from '@/components/exports/CreateExportButton';
import ExportDownloadButton from '@/components/exports/ExportDownloadButton';
import { formatDate } from '@/lib/utils';

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
  const isAdmin = user.role === 'ADMIN';

  let validatedCount = 0;
  let batches = [];

  const invoiceWhere = isAdmin
    ? { validationStatus: 'VALIDATED' }
    : orgId
    ? { organizationId: orgId, validationStatus: 'VALIDATED' }
    : { id: '__none__' };

  const batchWhere = isAdmin
    ? {}
    : orgId
    ? { organizationId: orgId }
    : { id: '__none__' };

  try {
    const [count, batchList] = await Promise.all([
      prisma.invoice.count({
        where: invoiceWhere,
      }),
      prisma.exportBatch.findMany({
        where: batchWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    validatedCount = count || 0;
    batches = batchList || [];
  } catch (err) {
    console.error('Error loading exports data:', err);
  }

  // Serialize dates for safe client rendering
  const serializedBatches = batches.map((batch) => ({
    ...batch,
    createdAt: batch.createdAt ? batch.createdAt.toISOString() : new Date().toISOString(),
    createdBy: batch.createdBy || null,
  }));

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
              <Icon name="CheckCircle2" className="w-6 h-6" />
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

          {validatedCount > 0 ? (
            <Link href="/invoices?status=VALIDATED">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all">
                View Validated Invoices
                <Icon name="ArrowRight" className="w-3.5 h-3.5" />
              </span>
            </Link>
          ) : (
            <Link href="/invoices">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all">
                Review Pending Invoices
                <Icon name="ArrowRight" className="w-3.5 h-3.5" />
              </span>
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
          {serializedBatches.length === 0 ? (
            <div className="p-8">
              <div className="flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-5 shadow-sm">
                  <Icon name="FileSpreadsheet" className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">No CSV exports generated yet</h3>
                <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
                  Once invoices pass validation checks, generate your first clean, spreadsheet-ready CSV export.
                </p>
              </div>
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
                  {serializedBatches.map((batch) => (
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
                        <ExportDownloadButton batchId={batch.id} />
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
