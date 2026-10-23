// ─────────────────────────────────────────────────────────────────
// ValidationChart — Donut breakdown of validation pipeline states
// ─────────────────────────────────────────────────────────────────

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Card, { CardHeader, CardBody } from '../ui/Card';
import { PieChart as PieIcon } from 'lucide-react';

export default function ValidationChart({ data = [] }) {
  const hasData = data && data.length > 0 && data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-navy-900">Validation Status Ratio</h3>
          </div>
        </CardHeader>
        <CardBody className="h-64 flex items-center justify-center text-xs text-gray-400">
          No validation metrics available yet.
        </CardBody>
      </Card>
    );
  }

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-navy-900">Status Distribution</h3>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            {total} Total
          </span>
        </div>
      </CardHeader>
      <CardBody className="h-64 p-4 flex flex-col justify-between">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    const pct = Math.round((item.value / total) * 100);
                    return (
                      <div className="bg-navy-900 text-white px-3 py-1.5 rounded-xl text-xs shadow-lg">
                        <span className="font-semibold">{item.name}</span>: {item.value} ({pct}%)
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-gray-600">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
