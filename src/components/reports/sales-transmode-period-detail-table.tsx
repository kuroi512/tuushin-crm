'use client';

export type SalesTransmodePeriodMatrixPayload = {
  range: { start: string; end: string };
  modes: string[];
  rows: Array<{ manager: string; counts: Record<string, number>; total: number }>;
  columnTotals: Record<string, number>;
  grandTotal: number;
};

function formatNum(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

type Labels = {
  namesColumn: string;
  totalColumn: string;
  grandTotalRow: string;
};

export function SalesTransmodePeriodDetailTable({
  data,
  labels,
}: {
  data: SalesTransmodePeriodMatrixPayload;
  labels: Labels;
}) {
  const { modes, rows, columnTotals, grandTotal } = data;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse border border-gray-900 text-sm">
        <thead>
          <tr className="bg-sky-100">
            <th className="border border-gray-900 px-2 py-2 text-left font-semibold">
              {labels.namesColumn}
            </th>
            {modes.map((mode) => (
              <th key={mode} className="border border-gray-900 px-2 py-2 text-center font-semibold">
                {mode}
              </th>
            ))}
            <th className="border border-gray-900 px-2 py-2 text-center font-semibold">
              {labels.totalColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.manager}>
              <td className="border border-gray-900 px-2 py-1.5 text-left font-medium">
                {row.manager}
              </td>
              {modes.map((mode) => (
                <td
                  key={`${row.manager}-${mode}`}
                  className="border border-gray-900 px-2 py-1.5 text-center font-semibold"
                >
                  {formatNum(row.counts[mode] ?? 0)}
                </td>
              ))}
              <td className="border border-gray-900 px-2 py-1.5 text-center font-semibold">
                {formatNum(row.total)}
              </td>
            </tr>
          ))}
          <tr className="bg-sky-100">
            <th className="border border-gray-900 px-2 py-2 text-left font-semibold">
              {labels.grandTotalRow}
            </th>
            {modes.map((mode) => (
              <td
                key={`tot-${mode}`}
                className="border border-gray-900 px-2 py-2 text-center font-semibold"
              >
                {formatNum(columnTotals[mode] ?? 0)}
              </td>
            ))}
            <td className="border border-gray-900 bg-yellow-200 px-2 py-2 text-center font-bold">
              {formatNum(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
