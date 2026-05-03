'use client';

import { Fragment } from 'react';

export type YtdSalesTransmodeMatrixData = {
  referenceDate: string;
  previousYear: number;
  currentYear: number;
  previousRange: { start: string; end: string };
  currentRange: { start: string; end: string };
  managers: string[];
  modeRows: Array<{
    mode: string;
    byManager: Array<{ prev: number; curr: number }>;
    sumPrev: number;
    sumCurr: number;
    growthPct: string;
  }>;
  totalsByManager: Array<{ prev: number; curr: number }>;
  teuByManager: Array<{ prev: number; curr: number }>;
  grandTotals: { prev: number; curr: number; growthPct: string };
  grandTeu: { prev: number; curr: number; growthPct: string };
};

function formatNum(value: number, decimals = 0) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}

type Labels = {
  modeColumn: string;
  totalCol: string;
  growthCol: string;
  totalsRow: string;
  teuRow: string;
};

export function YtdSalesTransmodeMatrixTable({
  data,
  labels,
}: {
  data: YtdSalesTransmodeMatrixData;
  labels: Labels;
}) {
  const py = data.previousYear;
  const cy = data.currentYear;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse border border-gray-300 text-center text-[11px] sm:text-xs">
        <thead>
          <tr>
            <th
              className="border border-gray-300 bg-gray-100 px-1 py-2 align-middle font-medium"
              rowSpan={2}
            >
              {labels.modeColumn}
            </th>
            {data.managers.map((name) => (
              <th
                key={name}
                className="border border-gray-300 bg-gray-100 px-1 py-1 font-semibold"
                colSpan={2}
              >
                {name}
              </th>
            ))}
            <th className="border border-gray-300 bg-gray-100 px-1 py-1 font-semibold" colSpan={2}>
              {labels.totalCol}
            </th>
            <th
              className="border border-gray-300 bg-gray-100 px-1 py-2 align-middle text-[10px] font-semibold sm:text-xs"
              rowSpan={2}
            >
              {labels.growthCol}
            </th>
          </tr>
          <tr>
            {data.managers.map((name) => (
              <Fragment key={`${name}-sub`}>
                <th className="border border-gray-300 bg-gray-50 px-0.5 py-1 font-normal">{py}</th>
                <th className="border border-gray-300 bg-gray-50 px-0.5 py-1 font-normal">{cy}</th>
              </Fragment>
            ))}
            <th className="border border-gray-300 bg-gray-50 px-0.5 py-1 font-normal">{py}</th>
            <th className="border border-gray-300 bg-gray-50 px-0.5 py-1 font-normal">{cy}</th>
          </tr>
        </thead>
        <tbody>
          {data.modeRows.map((row) => (
            <tr key={row.mode}>
              <th className="border border-gray-300 bg-gray-50 px-2 py-1 text-left font-medium">
                {row.mode}
              </th>
              {row.byManager.map((cell, idx) => (
                <Fragment key={`${row.mode}-${idx}`}>
                  <td className="border border-gray-300 px-1 py-0.5">{formatNum(cell.prev)}</td>
                  <td className="border border-gray-300 px-1 py-0.5">{formatNum(cell.curr)}</td>
                </Fragment>
              ))}
              <td className="border border-gray-300 px-1 py-0.5 font-semibold">
                {formatNum(row.sumPrev)}
              </td>
              <td className="border border-gray-300 px-1 py-0.5 font-semibold">
                {formatNum(row.sumCurr)}
              </td>
              <td className="border border-gray-300 px-1 py-0.5 font-semibold">{row.growthPct}</td>
            </tr>
          ))}
          <tr>
            <th className="border border-gray-300 bg-rose-50 px-2 py-1 text-left font-semibold text-rose-900">
              {labels.totalsRow}
            </th>
            {data.totalsByManager.map((cell, idx) => (
              <Fragment key={`tot-${idx}`}>
                <td className="border border-gray-300 bg-rose-50/90 px-1 py-0.5 font-semibold text-rose-900">
                  {formatNum(cell.prev)}
                </td>
                <td className="border border-gray-300 bg-rose-50/90 px-1 py-0.5 font-semibold text-rose-900">
                  {formatNum(cell.curr)}
                </td>
              </Fragment>
            ))}
            <td className="border border-gray-300 bg-rose-50 px-1 py-0.5 font-bold text-rose-900">
              {formatNum(data.grandTotals.prev)}
            </td>
            <td className="border border-gray-300 bg-rose-50 px-1 py-0.5 font-bold text-rose-900">
              {formatNum(data.grandTotals.curr)}
            </td>
            <td className="border border-gray-300 bg-rose-50 px-1 py-0.5 font-bold text-rose-900">
              {data.grandTotals.growthPct}
            </td>
          </tr>
          <tr>
            <th className="border border-gray-300 bg-rose-50 px-2 py-1 text-left font-semibold text-rose-900">
              {labels.teuRow}
            </th>
            {data.teuByManager.map((cell, idx) => (
              <Fragment key={`teu-${idx}`}>
                <td className="border border-gray-300 bg-rose-50/90 px-1 py-0.5 text-rose-900">
                  {formatNum(cell.prev, 1)}
                </td>
                <td className="border border-gray-300 bg-rose-50/90 px-1 py-0.5 text-rose-900">
                  {formatNum(cell.curr, 1)}
                </td>
              </Fragment>
            ))}
            <td className="border border-gray-300 bg-rose-50 px-1 py-0.5 font-bold text-rose-900">
              {formatNum(data.grandTeu.prev, 1)}
            </td>
            <td className="border border-gray-300 bg-rose-50 px-1 py-0.5 font-bold text-rose-900">
              {formatNum(data.grandTeu.curr, 1)}
            </td>
            <td className="border border-gray-300 bg-rose-50 px-1 py-0.5 font-bold text-rose-900">
              {data.grandTeu.growthPct}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
