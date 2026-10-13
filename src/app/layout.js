// ─────────────────────────────────────────────────────────────────
// Root Layout — InvoiceFlow
// Sets up fonts, metadata, and global providers
// ─────────────────────────────────────────────────────────────────

import './globals.css';

export const metadata = {
  title: 'InvoiceFlow — AI-Powered Invoice Verification',
  description: 'Upload, verify, and export invoices with AI-powered extraction and validation. Professional invoice processing for modern businesses.',
  keywords: ['invoice', 'verification', 'AI', 'document intelligence', 'CSV export'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
