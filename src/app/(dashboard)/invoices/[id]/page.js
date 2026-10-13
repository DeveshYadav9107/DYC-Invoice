// ─────────────────────────────────────────────────────────────────
// Invoice Detail & Verification Review Page — Two-column view
// Document preview on left, extracted fields + review form on right
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import InvoiceReviewForm from '@/components/invoices/InvoiceReviewForm';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import InvoiceDetailActions from '@/components/invoices/InvoiceDetailActions';
import { formatFileSize, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  return {
    title: `Review Invoice — InvoiceFlow`,
  };
}

export default async function InvoiceDetailPage({ params }) {
  const sessionData = await requireSession();
  if (!sessionData || !sessionData.user) {
    notFound();
  }
  const user = sessionData.user;
  const resolvedParams = await params;
  const invoiceId = resolvedParams.id;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: true,
      validationIssues: true,
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  // Tenant security
  if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
    notFound();
  }

  // Serialize Decimal objects for client components
  const serializedInvoice = {
    ...invoice,
    subtotal: invoice.subtotal ? Number(invoice.subtotal) : null,
    taxAmount: invoice.taxAmount ? Number(invoice.taxAmount) : null,
    discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : null,
    additionalCharges: invoice.additionalCharges ? Number(invoice.additionalCharges) : null,
    totalAmount: invoice.totalAmount ? Number(invoice.totalAmount) : null,
    invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.toISOString() : null,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    lineItems: invoice.lineItems.map((item) => ({
      ...item,
      quantity: item.quantity ? Number(item.quantity) : null,
      unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
      taxAmount: item.taxAmount ? Number(item.taxAmount) : null,
      totalAmount: item.totalAmount ? Number(item.totalAmount) : null,
      createdAt: item.createdAt.toISOString(),
    })),
    validationIssues: invoice.validationIssues.map((issue) => ({
      ...issue,
      resolvedAt: issue.resolvedAt ? issue.resolvedAt.toISOString() : null,
      createdAt: issue.createdAt.toISOString(),
    })),
  };

  const isPdf = invoice.mimeType === 'application/pdf';
  const fileUrl = `/api/invoices/${invoice.id}/file`;

  return (
    <div className="space-y-6">
      {/* ─── Top Breadcrumb Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-xl text-gray-500 hover:text-navy-900 hover:bg-gray-100 transition-colors"
            title="Back to invoices"
          >
            <Icon name="ChevronLeft" className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-navy-900 truncate max-w-md">
                {invoice.originalFileName}
              </h1>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Uploaded on {formatDate(invoice.createdAt)} by {invoice.uploadedBy?.name || invoice.uploadedBy?.email || 'User'}
            </p>
          </div>
        </div>

        <InvoiceDetailActions fileUrl={fileUrl} originalFileName={invoice.originalFileName} />
      </div>

      {/* ─── Two-Column Split Review Grid ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ─── Left: Document Viewer ──────────────────────────── */}
        <Card className="sticky top-20 overflow-hidden bg-navy-950/5">
          <CardHeader className="bg-white flex flex-row items-center justify-between py-3 px-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-800">
              <Icon name="FileText" className="w-4 h-4 text-brand-600" />
              <span>Original Document Viewer</span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              {formatFileSize(invoice.fileSize)} • {invoice.mimeType}
            </span>
          </CardHeader>

          <CardBody className="p-0 bg-gray-900/5">
            <div className="w-full h-[750px] flex items-center justify-center bg-gray-100/50">
              {isPdf ? (
                <iframe
                  src={`${fileUrl}#toolbar=0`}
                  title="Invoice PDF Preview"
                  className="w-full h-full border-none rounded-b-2xl"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={fileUrl}
                    alt="Invoice preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ─── Right: Extracted Fields & Review Form ──────────── */}
        <InvoiceReviewForm invoice={serializedInvoice} />
      </div>
    </div>
  );
}
