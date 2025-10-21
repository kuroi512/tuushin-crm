'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import type { Quotation } from '@/types/quotation';

const CONTACT_LINES = [
  '"Tuushin" tower, Prime Minister Amar\'s 15, Sukhbaatar district, Ulaanbaatar 14200-0048',
  '(+976) 11320064, 11312092',
  'freight@tuushin.mn',
];

function currencySymbol(code?: string | null): string {
  if (!code) return '';
  switch (code.toLowerCase()) {
    case 'eur':
      return '€';
    case 'gbp':
      return '£';
    case 'jpy':
    case 'cny':
    case 'rmb':
      return '¥';
    case 'mnt':
      return '₮';
    case 'krw':
      return '₩';
    case 'rub':
      return '₽';
    case 'usd':
      return '$';
    default:
      return '';
  }
}

function safeDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch (error) {
    return value.slice(0, 10);
  }
}

function splitLines(value?: string | null): string[] {
  return (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function QuotationPrintPage() {
  const params = useParams() as { id?: string };
  const id = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<Quotation | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/quotations/${id}`);
        const payload = await response.json();
        if (!cancelled && payload?.success) {
          setQuotation(payload.data as Quotation);
        }
      } catch (error) {
        console.error('Failed to load quotation for print view', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const sizeSummary = useMemo(() => {
    const dims = Array.isArray(quotation?.dimensions) ? quotation.dimensions : [];
    const totals = dims.reduce(
      (acc, dim) => {
        const quantity = Number(dim.quantity || 0);
        const cbmValue = Number(
          dim.cbm ||
            (Number(dim.length || 0) *
              Number(dim.width || 0) *
              Number(dim.height || 0) *
              quantity) /
              1_000_000,
        );
        return {
          quantity: acc.quantity + quantity,
          cbm: Number((acc.cbm + cbmValue).toFixed(3)),
        };
      },
      { quantity: 0, cbm: 0 },
    );

    return {
      quantity: totals.quantity,
      cbm: totals.cbm,
      weight: Number(quotation?.weight || 0),
    };
  }, [quotation]);

  const primaryRate = useMemo(() => {
    if (!quotation?.customerRates?.length) return null;
    return quotation.customerRates.find((rate) => rate.isPrimary) || quotation.customerRates[0];
  }, [quotation?.customerRates]);

  const rateCurrency = quotation?.profit?.currency || primaryRate?.currency || 'USD';
  const rateAmount = Number(
    quotation?.profit?.amount ?? primaryRate?.amount ?? quotation?.estimatedCost ?? 0,
  );

  const includes = useMemo(
    () => splitLines(quotation?.included || quotation?.include),
    [quotation?.include, quotation?.included],
  );

  const excludes = useMemo(
    () => splitLines(quotation?.excluded || quotation?.exclude),
    [quotation?.exclude, quotation?.excluded],
  );

  const remarks = useMemo(
    () =>
      splitLines(
        quotation?.remark ||
          quotation?.additionalInfo ||
          quotation?.operationNotes ||
          quotation?.comment,
      ),
    [quotation?.additionalInfo, quotation?.comment, quotation?.operationNotes, quotation?.remark],
  );

  const consignee = quotation?.consignee || quotation?.client || '-';
  const issuedDate = safeDate(quotation?.quotationDate || quotation?.createdAt);
  const validDate = safeDate(quotation?.validityDate);
  const quotationNo = quotation?.quotationNumber || quotation?.registrationNo || '-';
  const pickupAddress = quotation?.originAddress || quotation?.origin || 'n/a';
  const deliveryAddress =
    quotation?.finalAddress || quotation?.destinationAddress || quotation?.destination || 'n/a';
  const transportRoute =
    quotation?.via?.trim() ||
    [quotation?.origin, quotation?.destination].filter(Boolean).join(' -> ') ||
    '-';
  const transitTime = safeDate(quotation?.estArrivalDate);

  const formattedRate = useMemo(
    () =>
      rateAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [rateAmount],
  );

  return (
    <div className="print-wrapper">
      <style jsx>{`
        @import url('/fonts/montserrat-print-only.css');
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');

        .print-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .page[data-size='A4'] {
          background: #ffffff;
          width: calc(210mm - 20mm);
          min-height: calc(297mm - 20mm);
          margin: 0 auto 0.5cm;
          display: flex;
          flex-direction: column;
          font-family: 'Montserrat', sans-serif;
          color: #0b2b55;
        }

        .page-shell {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 12mm 10mm 18mm;
          font-size: 11px;
          line-height: 1.5;
        }

        .header-image,
        .divider-image,
        .footer-logos {
          width: 100%;
          height: auto;
          display: block;
        }

        .contact-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-top: 14px;
          font-size: 10px;
          color: #1a1a1a;
        }

        .contact-row ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 4px;
        }

        .contact-row li::before {
          content: '• ';
          font-weight: 700;
        }

        .offer-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0b2b55;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .meta-label {
          font-weight: 600;
          color: #43536d;
        }

        .meta-value {
          font-weight: 700;
          color: #1a1a1a;
        }

        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
          color: #1a1a1a;
        }

        .info-table th,
        .info-table td {
          border: 1px solid #d1d5db;
          padding: 6px 10px;
          text-align: left;
        }

        .info-table th {
          width: 26%;
          text-transform: uppercase;
          font-weight: 600;
          color: #0b2b55;
          background: #f6f8fc;
        }

        .content-section {
          margin-top: 18px;
          display: grid;
          gap: 22px;
          color: #0b2b55;
        }

        .summary-line {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .summary-sub {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .rates-table {
          width: 100%;
          border-collapse: collapse;
          color: #1a1a1a;
          font-size: 11px;
          table-layout: fixed;
        }

        .rates-table th,
        .rates-table td {
          border: 1px solid #0b2b55;
          padding: 6px 8px;
          word-break: break-word;
        }

        .rates-table th {
          background: #f2f6fb;
          font-weight: 700;
          text-transform: uppercase;
          color: #0b2b55;
        }

        .section-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .list-block ul {
          margin: 0;
          padding-left: 18px;
          color: #1a1a1a;
        }

        .list-block li {
          margin-bottom: 4px;
        }

        .footer {
          margin-top: auto;
          padding-top: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: #1a1a1a;
          font-size: 10px;
          text-align: center;
        }

        .print-controls {
          position: fixed;
          right: 28px;
          bottom: 24px;
          display: flex;
          gap: 12px;
        }

        @media print {
          .print-controls {
            display: none !important;
          }

          .page[data-size='A4'] {
            margin: 0;
            box-shadow: none;
          }
        }
      `}</style>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 10mm;
        }
        @media print {
          html,
          body {
            width: calc(210mm - 20mm);
            height: calc(297mm - 20mm);
            margin: 0 !important;
            padding: 0 !important;
          }
          .page[data-size='A4'] {
            width: calc(210mm - 20mm) !important;
            min-height: calc(297mm - 20mm);
          }
          .page * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div data-size="A4" className="page">
        <div className="print-controls print:hidden">
          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow"
            onClick={() => window.print()}
          >
            Save as PDF
          </button>
        </div>

        {loading ? (
          <div className="grid flex-1 place-items-center text-sm text-[#0b2b55]">Loading…</div>
        ) : (
          <div className="page-shell">
            <header>
              <img src="/header.png" alt="Tuushin Logistics header" className="header-image" />
              <div className="contact-row">
                <ul>
                  {CONTACT_LINES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="offer-title">The Freight Rate Offer</div>
              </div>

              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Customer name</span>
                  <span className="meta-value">{consignee}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Date</span>
                  <span className="meta-value">{issuedDate}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Valid date</span>
                  <span className="meta-value">{validDate}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Number</span>
                  <span className="meta-value">{quotationNo}</span>
                </div>
              </div>

              <table className="info-table">
                <tbody>
                  <tr>
                    <th>Consignee</th>
                    <td>{consignee}</td>
                    <th>Commodity</th>
                    <td>{quotation?.commodity || 'n/a'}</td>
                  </tr>
                  <tr>
                    <th>Transportation mode</th>
                    <td>{quotation?.tmode || 'n/a'}</td>
                    <th>Type</th>
                    <td>{quotation?.cargoType || quotation?.type || 'n/a'}</td>
                  </tr>
                  <tr>
                    <th>POL</th>
                    <td>{quotation?.origin || 'n/a'}</td>
                    <th>Contacted</th>
                    <td>{quotation?.salesManager || quotation?.tariffManager || 'n/a'}</td>
                  </tr>
                  <tr>
                    <th>Default comment</th>
                    <td colSpan={3}>{quotation?.comment || quotation?.operationNotes || 'n/a'}</td>
                  </tr>
                </tbody>
              </table>

              <img src="/line.png" alt="Section divider" className="divider-image" />
            </header>

            <main className="content-section">
              <section>
                <p className="summary-line">
                  Shipment details: {sizeSummary.quantity} pallet/package · {sizeSummary.weight} KG
                  · {sizeSummary.cbm} CBM
                </p>
                <p className="summary-sub">Pick up address: {pickupAddress}</p>
                <p className="summary-sub">Delivery address: {deliveryAddress}</p>
              </section>

              <section>
                <table className="rates-table">
                  <thead>
                    <tr>
                      <th>Order number</th>
                      <th>Quotation number</th>
                      <th>Transport mode</th>
                      <th>Transportation route</th>
                      <th>Shipment condition</th>
                      <th>Transit time</th>
                      <th>Rate</th>
                      <th>Gross weight</th>
                      <th>Dimensions (cbm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{quotation?.registrationNo || quotationNo}</td>
                      <td>{quotationNo}</td>
                      <td>{quotation?.cargoType || quotation?.tmode || '-'}</td>
                      <td>{transportRoute}</td>
                      <td>{quotation?.incoterm || quotation?.condition || '-'}</td>
                      <td>{transitTime}</td>
                      <td>
                        {currencySymbol(rateCurrency)}
                        {formattedRate}
                      </td>
                      <td>{sizeSummary.weight} KG</td>
                      <td>{sizeSummary.cbm} CBM</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {includes.length > 0 && (
                <section className="list-block">
                  <div className="section-title">The price includes</div>
                  <ul>
                    {includes.map((item) => (
                      <li key={`include-${item}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {excludes.length > 0 && (
                <section className="list-block">
                  <div className="section-title">The price excludes</div>
                  <ul>
                    {excludes.map((item) => (
                      <li key={`exclude-${item}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {remarks.length > 0 && (
                <section className="list-block">
                  <div className="section-title">Remarks</div>
                  <ul>
                    {remarks.map((item) => (
                      <li key={`remark-${item}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </main>

            <footer className="footer">
              <p>
                If you have any questions or concerns, please contact us without hesitation. Thank
                you.
              </p>
              <img src="/logos.png" alt="Tuushin certifications" className="footer-logos" />
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
