'use client';

// ─────────────────────────────────────────────────────────────────
// ActivityChart — Monthly invoice processing volume & amount trend
// Built with Recharts and customized for InvoiceFlow design system
// ─────────────────────────────────────────────────────────────────

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

export default function ActivityChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-navy-900">Processing Activity</h3>
          </div>
        </CardHeader>
        <CardBody className="h-64 flex items-center justify-center text-xs text-gray-400">
          Upload and process invoices to view volume trends over time.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-navy-900">Processing Volume</h3>
          </div>
          <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
            Monthly History
          </span>
        </div>
      </CardHeader>
      <CardBody className="h-64 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-navy-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg space-y-1">
                      <p className="font-semibold">{item.month}</p>
                      <p className="text-brand-300">Invoices: {item.count}</p>
                      <p className="text-emerald-300">Total: {formatCurrency(item.amount)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#0284c7"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#brandGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
