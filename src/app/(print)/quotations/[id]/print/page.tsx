'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Quotation } from '@/types/quotation';

function currencySymbol(code?: string): string {
  if (!code) return '';
  const c = code.toLowerCase();
  switch (c) {
    case 'eur':
      return '€';
    case 'jpy':
      return '¥';
    case 'mnt':
      return '₮';
    case 'krw':
      return '₩';
    case 'rmb':
    case 'cny':
      return '¥';
    case 'rub':
      return '₽';
    case 'usd':
      return '$';
    default:
      return '';
  }
}

export default function QuotationPrintPage() {
  const params = useParams() as { id?: string };
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<Quotation | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quotations/${id}`);
        const json = await res.json();
        if (!cancelled && json?.success) setQ(json.data as Quotation);
      } catch (error) {
        console.error('Failed to fetch quotation for print view', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sizeData = useMemo(() => {
    const dims = Array.isArray(q?.dimensions) ? q?.dimensions : [];
    const totals = (dims || []).reduce(
      (acc, d) => {
        const quantity = Number(d.quantity || 0);
        const cbm = Number(
          d.cbm ||
            (Number(d.length || 0) * Number(d.width || 0) * Number(d.height || 0) * quantity) /
              1_000_000,
        );
        return {
          qnt: acc.qnt + quantity,
          cbm: Number((acc.cbm + cbm).toFixed(3)),
        };
      },
      { qnt: 0, cbm: 0 },
    );
    return {
      qnt: totals.qnt,
      cbm: totals.cbm,
      volume_weight: q?.weight || 0,
    };
  }, [q]);

  return (
    <div className="w-full">
      {/* Scoped styles for screen and print */}
      <style jsx>{`
        @import url('/fonts/montserrat-print-only.css');
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap');

        .page[data-size='A4'] {
          background: white;
          width: 21cm;
          height: 29.7cm;
          display: block;
          margin: 0 auto;
          margin-bottom: 0.5cm;
          font-family: 'Montserrat', sans-serif;
          padding: 0;
        }

        .title-large {
          font-family: 'Montserrat', 'Arial', 'Helvetica', sans-serif !important;
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          font-style: normal !important;
          line-height: 1.1 !important;
          text-transform: uppercase !important;
          color: #000000 !important;
          letter-spacing: -0.02em !important;
        }

        .title-pill {
          background: #0b2b55;
          color: #ffffff;
          padding: 10px 24px;
          border-top-left-radius: 20px;
          border-bottom-left-radius: 20px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .meta-label {
          color: #555;
          font-weight: 600;
        }
        .meta-value {
          font-weight: 700;
        }

        .table th,
        .table td {
          border: 1.5px solid #9b1b1b;
        }
        .table th {
          color: #b11a1a;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-style: italic;
          text-align: center;
        }
        .table thead tr:first-child th {
          text-align: left;
          background: transparent;
          color: #0b2b55;
          text-decoration: none;
        }
        .table tbody td {
          min-height: 42px;
        }

        .contact-bullets {
          font-size: 10px;
          line-height: 1.15;
        }
        .contact-bullets li {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .contact-bullets li::before {
          content: '\\2022';
          color: #0b2b55;
          font-weight: 900;
        }

        @media print {
          body,
          .page[data-size='A4'] {
            margin: 0;
            height: 100%;
            overflow-y: unset;
            box-shadow: 0;
          }
          .footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .hidden {
            display: none;
            content-visibility: hidden;
          }
          .page-break {
            page-break-before: auto;
            page-break-inside: avoid;
          }
        }
        .hidden {
          display: flex;
        }
        .printArea {
          overflow-wrap: break-word;
          padding: 1cm 2cm 1cm 2cm;
        }
      `}</style>
      {/* Global print overrides */}
      <style jsx global>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          html,
          body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
          }
          .page[data-size='A4'] {
            width: 210mm !important;
            min-height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
          }
          .printArea {
            padding: 10mm 20mm 10mm 20mm !important;
            box-sizing: border-box;
          }
          .page * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div
        data-size="A4"
        className="page print-page h-full max-h-screen overflow-y-scroll font-[Montserrat]"
      >
        <div className="fixed right-0 bottom-0 mr-8 mb-6 hidden flex-row gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white shadow"
          >
            Save as PDF
          </button>
        </div>

        {loading ? (
          <div className="fixed inset-0 grid place-items-center text-sm">Loading…</div>
        ) : (
          <div className="body printArea text-xs">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <img src="/logo.svg" alt="Logo" className="mt-1 h-12" />
                <ul className="contact-bullets mt-1">
                  <li>
                    <span>
                      &quot;ТУУШИН&quot; ХХК төв оффис, ерөнхий сайт Амарын гудамж-15 Улаанбаатар
                      хот 14200-0048
                    </span>
                  </li>
                  <li>
                    <span>(+976) 11320064, 11312092</span>
                  </li>
                  <li>
                    <span>(+976)</span>
                  </li>
                </ul>
              </div>
              <div className="title-pill text-sm">ТЭЭВРИЙН ҮНИЙН САНАЛ</div>
            </div>

            {/* Divider */}
            <div className="mt-3 h-[2px] w-full bg-gray-200" />

            {/* Meta row */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="meta-label">Харилцагч:</span>
                <span className="meta-value">{q?.client || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="meta-label">Огноо:</span>
                <span className="meta-value">
                  {(q?.quotationDate || q?.createdAt)?.slice(0, 10)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="meta-label">Хүчинтэй хугацаа:</span>
                <span className="meta-value">{q?.validityDate?.slice(0, 10) || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="meta-label">Дугаар:</span>
                <span className="meta-value">{q?.quotationNumber || '-'}</span>
              </div>
            </div>

            {/* Thin divider */}
            <div className="my-2 h-px w-full bg-gray-300" />

            {/* Freight info line */}
            <div className="mb-2 text-[12px] font-bold">
              АЧААНЫ МЭДЭЭЛЭЛ: {q?.dimensions?.length || 0} pallet/package • {q?.weight || 0} KG •{' '}
              {sizeData.cbm} CBM
            </div>

            {/* Shipment summary */}

            {/* Main table matching template */}
            <table className="mt-3 table w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-1" colSpan={10}></th>
                </tr>
                <tr>
                  <th className="p-1">Ачилтын газар</th>
                  <th className="p-1">Хүргэх газар</th>
                  <th className="p-1">Тээврийн төрөл</th>
                  <th className="p-1">Тээврийн нөхцөл</th>
                  <th className="p-1">Валют</th>
                  <th className="p-1">Холбогдох мэдээлэл</th>
                  <th className="p-1">Агентын нэр</th>
                  <th className="p-1">Хүргэлтийн хугацаа</th>
                  <th className="p-1">Нийт жин(кг)</th>
                  <th className="p-1">Үнийн дүн</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 align-top">{q?.origin || '-'}</td>
                  <td className="p-2 align-top">{q?.destination || '-'}</td>
                  <td className="p-2 align-top">{q?.tmode || '-'}</td>
                  <td className="p-2 align-top">{q?.incoterm || '-'}</td>
                  <td className="p-2 align-top">
                    {q?.customerRates?.[0]?.currency || q?.profit?.currency || 'USD'}
                  </td>
                  <td className="p-2 align-top whitespace-pre-line italic">
                    {q?.via || `${q?.origin || ''} -> ${q?.destination || ''}`}
                  </td>
                  <td className="p-2 align-top">{q?.tariffManager || q?.salesManager || '-'}</td>
                  <td className="p-2 align-top">
                    {q?.estArrivalDate ? `${q?.estArrivalDate?.slice(0, 10)} (est)` : '-'}
                  </td>
                  <td className="p-2 align-top">{q?.weight || 0}</td>
                  <td className="p-2 align-top font-semibold">
                    {currencySymbol(q?.profit?.currency || q?.customerRates?.[0]?.currency)}
                    {q?.profit?.amount ?? q?.estimatedCost}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="my-5 h-3 w-full bg-[#091e36]" />

            {(q?.include || q?.included) && (
              <div className="mt-5">
                <div className="mb-1 font-extrabold text-[#b11a1a] uppercase">
                  Үнэлгээнд доорх зүйл багтсан болно
                </div>
                <ul className="list-disc pl-6 text-[12px] whitespace-pre-line">
                  {(q?.included || q?.include || '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={`inc-${i}`}>{line}</li>
                    ))}
                </ul>
              </div>
            )}

            {(q?.exclude || q?.excluded) && (
              <div className="mt-5">
                <div className="mb-1 font-extrabold text-[#b11a1a] uppercase">
                  Үнэлгээнд доорх зүйл багтаагүй болно
                </div>
                <ul className="list-disc pl-6 text-[12px] whitespace-pre-line">
                  {(q?.excluded || q?.exclude || '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={`exc-${i}`}>{line}</li>
                    ))}
                </ul>
              </div>
            )}

            <div className="my-5 h-3 w-full bg-[#091e36]" />

            <div className="grid grid-cols-2 gap-y-1 pl-5">
              <div className="flex flex-col">
                <p className="font-bold">{q?.finalAddress || q?.destinationAddress || ''}</p>
                <p>Утас: {/* add company phone when available */}</p>
              </div>
              <div className="flex flex-col">
                <div className="grid grid-cols-2">
                  <p>Борлуулалтын мэргэжилтэн:</p>
                  <p>{q?.salesManager || ''}</p>
                </div>
                <div className="grid grid-cols-2">
                  <p>Утас:</p>
                  <p>{''}</p>
                </div>
                <div className="grid grid-cols-2">
                  <p>И-мэйл:</p>
                  <p>{''}</p>
                </div>
                <div className="grid grid-cols-2">
                  <p>Огноо:</p>
                  <p>{(q?.quotationDate || q?.createdAt)?.slice(0, 10)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
