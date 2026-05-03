'use client';

import { Fragment } from 'react';

export type ImportRegistrationBlock = {
  modeRows: Array<{
    mode: string;
    cells: Array<{ urd: number; hoid: number }>;
    sumUrd: number;
    sumHoid: number;
    rowTeu: number;
  }>;
  footerCounts: Array<{ urd: number; hoid: number }>;
  footerSumUrd: number;
  footerSumHoid: number;
  footerTeuByManager: number[];
  grandTeu: number;
};

export type ImportRegistrationBySalesPayload = {
  managers: string[];
  previousRange: { start: string; end: string };
  currentRange: { start: string; end: string };
  previousYear: number;
  currentYear: number;
  prev: ImportRegistrationBlock;
  curr: ImportRegistrationBlock;
  teuYoYGrowthPct: string;
};

type Labels = {
  typeCol: string;
  urd: string;
  hoid: string;
  totalGroup: string;
  totalTeu: string;
  footerTotal: string;
  footerTeu: string;
};

function formatInt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

function formatTeu(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

function OnePeriodTable({
  rangeLabel,
  block,
  managers,
  labels,
  year,
}: {
  rangeLabel: string;
  year: number;
  managers: string[];
  block: ImportRegistrationBlock;
  labels: Labels;
}) {
  return (
    <div className="space-y-1">
      <p className="text-center text-xs font-medium text-gray-700 sm:text-left">
        {year}: {rangeLabel}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse border border-slate-400 text-center text-[10px] sm:text-xs">
          <thead>
            <tr>
              <th className="border border-slate-400 bg-sky-700 px-1 py-2 text-white" rowSpan={2}>
                {labels.typeCol}
              </th>
              {managers.map((name) => (
                <th
                  key={name}
                  className="border border-slate-400 bg-sky-700 px-0.5 py-1 text-[10px] font-semibold text-white sm:text-xs"
                  colSpan={2}
                >
                  {name}
                </th>
              ))}
              <th
                className="border border-slate-400 bg-sky-700 px-0.5 py-1 text-[10px] font-semibold text-white sm:text-xs"
                colSpan={2}
              >
                {labels.totalGroup}
              </th>
              <th
                className="border border-slate-400 bg-orange-200 px-1 py-2 text-orange-950"
                rowSpan={2}
              >
                {labels.totalTeu}
              </th>
            </tr>
            <tr>
              {managers.map((name) => (
                <Fragment key={`${name}-sub`}>
                  <th className="border border-slate-400 bg-sky-600 px-0.5 py-1 text-[10px] font-normal text-white">
                    {labels.urd}
                  </th>
                  <th className="border border-slate-400 bg-sky-600 px-0.5 py-1 text-[10px] font-normal text-white">
                    {labels.hoid}
                  </th>
                </Fragment>
              ))}
              <th className="border border-slate-400 bg-sky-600 px-0.5 py-1 font-normal text-white">
                {labels.urd}
              </th>
              <th className="border border-slate-400 bg-sky-600 px-0.5 py-1 font-normal text-white">
                {labels.hoid}
              </th>
            </tr>
          </thead>
          <tbody>
            {block.modeRows.map((row) => (
              <tr key={row.mode}>
                <th className="border border-slate-400 bg-slate-50 px-2 py-1 text-left font-medium">
                  {row.mode}
                </th>
                {row.cells.map((cell, idx) => (
                  <Fragment key={`${row.mode}-${idx}`}>
                    <td className="border border-slate-400 px-1 py-0.5">{formatInt(cell.urd)}</td>
                    <td className="border border-slate-400 px-1 py-0.5">{formatInt(cell.hoid)}</td>
                  </Fragment>
                ))}
                <td className="border border-slate-400 bg-slate-50 px-1 py-0.5 font-semibold">
                  {formatInt(row.sumUrd)}
                </td>
                <td className="border border-slate-400 bg-slate-50 px-1 py-0.5 font-semibold">
                  {formatInt(row.sumHoid)}
                </td>
                <td className="border border-slate-400 bg-orange-50 px-1 py-0.5 font-semibold text-orange-950">
                  {formatTeu(row.rowTeu)}
                </td>
              </tr>
            ))}
            <tr>
              <th className="border border-slate-400 bg-sky-800 px-2 py-1 text-left font-semibold text-white">
                {labels.footerTotal}
              </th>
              {block.footerCounts.map((cell, idx) => (
                <Fragment key={`ft-${idx}`}>
                  <td className="border border-slate-400 bg-sky-100 px-1 py-0.5 font-semibold">
                    {formatInt(cell.urd)}
                  </td>
                  <td className="border border-slate-400 bg-sky-100 px-1 py-0.5 font-semibold">
                    {formatInt(cell.hoid)}
                  </td>
                </Fragment>
              ))}
              <td className="border border-slate-400 bg-sky-200 px-1 py-0.5 font-bold">
                {formatInt(block.footerSumUrd)}
              </td>
              <td className="border border-slate-400 bg-sky-200 px-1 py-0.5 font-bold">
                {formatInt(block.footerSumHoid)}
              </td>
              <td className="border border-slate-400 bg-orange-100 px-1 py-0.5 font-bold text-orange-950">
                {formatTeu(block.grandTeu)}
              </td>
            </tr>
            <tr>
              <th className="border border-slate-400 bg-sky-900 px-2 py-1 text-left text-xs font-semibold text-white">
                {labels.footerTeu}
              </th>
              {block.footerTeuByManager.map((teu, idx) => (
                <td
                  key={`fte-${idx}`}
                  className="border border-slate-400 bg-sky-50 px-1 py-0.5 text-sky-950"
                  colSpan={2}
                >
                  {formatTeu(teu)}
                </td>
              ))}
              <td className="border border-slate-400 bg-sky-100 px-1 py-0.5 text-center text-sky-700">
                —
              </td>
              <td className="border border-slate-400 bg-sky-100 px-1 py-0.5 text-center text-sky-700">
                —
              </td>
              <td className="border border-slate-400 bg-orange-100 px-1 py-0.5 font-bold text-orange-950">
                {formatTeu(block.grandTeu)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ImportRegistrationBySalesTables({
  data,
  labels,
}: {
  data: ImportRegistrationBySalesPayload;
  labels: Labels;
}) {
  const prevLabel = `${data.previousRange.start}/${data.previousRange.end}`;
  const currLabel = `${data.currentRange.start}/${data.currentRange.end}`;

  return (
    <div className="space-y-8">
      {/* <OnePeriodTable
        year={data.previousYear}
        rangeLabel={prevLabel}
        managers={data.managers}
        block={data.prev}
        labels={labels}
      /> */}
      <OnePeriodTable
        year={data.currentYear}
        rangeLabel={currLabel}
        managers={data.managers}
        block={data.curr}
        labels={labels}
      />
    </div>
  );
}
