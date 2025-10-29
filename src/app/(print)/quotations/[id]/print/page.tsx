'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import type { Quotation, QuotationOffer } from '@/types/quotation';
import {
  getSelectionContent,
  normalizeRuleSelectionState,
} from '@/components/quotations/useRuleCatalog';
import { COPY_MAP, LANGUAGE_OPTIONS, type PrintLanguage } from './translate';

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
  } catch {
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
  const [language, setLanguage] = useState<PrintLanguage>('en');
  const copy = useMemo(() => COPY_MAP[language] ?? COPY_MAP.en, [language]);

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

  const sortedOffers = useMemo(() => {
    if (!quotation?.offers?.length) return [] as QuotationOffer[];
    return [...quotation.offers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [quotation?.offers]);

  const selectionState = useMemo(() => normalizeRuleSelectionState(quotation), [quotation]);
  const {
    include: selectionIncludes,
    exclude: selectionExcludes,
    remark: selectionRemarks,
  } = selectionState;

  const includes = useMemo(() => {
    const sourceList = Array.isArray(selectionIncludes) ? selectionIncludes : [];
    const fromSelections = sourceList
      .flatMap((item) => splitLines(getSelectionContent(item, language)))
      .filter(Boolean);
    if (fromSelections.length) return fromSelections;
    return splitLines(quotation?.included || quotation?.include);
  }, [language, quotation?.include, quotation?.included, selectionIncludes]);

  const excludes = useMemo(() => {
    const sourceList = Array.isArray(selectionExcludes) ? selectionExcludes : [];
    const fromSelections = sourceList
      .flatMap((item) => splitLines(getSelectionContent(item, language)))
      .filter(Boolean);
    if (fromSelections.length) return fromSelections;
    return splitLines(quotation?.excluded || quotation?.exclude);
  }, [language, quotation?.exclude, quotation?.excluded, selectionExcludes]);

  const remarks = useMemo(() => {
    const sourceList = Array.isArray(selectionRemarks) ? selectionRemarks : [];
    const fromSelections = sourceList
      .flatMap((item) => splitLines(getSelectionContent(item, language)))
      .filter(Boolean);
    if (fromSelections.length) return fromSelections;
    return splitLines(
      quotation?.remark ||
        quotation?.additionalInfo ||
        quotation?.operationNotes ||
        quotation?.comment ||
        quotation?.specialNotes,
    );
  }, [
    language,
    quotation?.additionalInfo,
    quotation?.comment,
    quotation?.specialNotes,
    quotation?.operationNotes,
    quotation?.remark,
    selectionRemarks,
  ]);

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

  const offerRows = useMemo(() => {
    const formatAmountWithCurrency = (
      amount?: number | null,
      currencyOverride?: string | null,
    ): string => {
      if (typeof amount !== 'number' || Number.isNaN(amount)) return '-';
      const code = (currencyOverride || rateCurrency || 'USD').toUpperCase();
      const symbol = currencySymbol(code);
      const formatted = amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (symbol) return `${symbol}${formatted}`;
      return code ? `${code} ${formatted}` : formatted;
    };

    const formatWeight = (value?: number | null): string => {
      if (typeof value !== 'number' || Number.isNaN(value)) return '-';
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} KG`;
    };

    const formatCbm = (value?: number | null): string => {
      if (typeof value !== 'number' || Number.isNaN(value)) return '-';
      return `${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      })} CBM`;
    };

    const computeDimensionsCbm = (offer?: QuotationOffer): number | undefined => {
      if (!offer) return undefined;
      if (typeof offer.dimensionsCbm === 'number' && Number.isFinite(offer.dimensionsCbm)) {
        return Number(offer.dimensionsCbm.toFixed(3));
      }
      if (Array.isArray(offer.dimensions) && offer.dimensions.length) {
        const total = offer.dimensions.reduce((acc, dim) => {
          if (!dim) return acc;
          const cbmValue = Number(
            dim.cbm ||
              (Number(dim.length || 0) *
                Number(dim.width || 0) *
                Number(dim.height || 0) *
                Number(dim.quantity || 0)) /
                1_000_000,
          );
          if (!Number.isFinite(cbmValue)) return acc;
          return acc + cbmValue;
        }, 0);
        return Number(total.toFixed(3));
      }
      return undefined;
    };

    if (sortedOffers.length) {
      return sortedOffers.map((offer, index) => {
        const titleBase = offer?.title?.trim();
        const title =
          titleBase && titleBase.length ? titleBase : `${copy.rateTable.offerTitle} ${index + 1}`;
        const numberValue = offer?.offerNumber?.trim() || quotationNo;
        const transportModeValue = offer?.transportMode || quotation?.tmode || quotation?.cargoType;
        const routeValue = offer?.routeSummary || transportRoute;
        const shipmentConditionValue =
          offer?.shipmentCondition ||
          offer?.incoterm ||
          quotation?.incoterm ||
          quotation?.condition;
        const transitTimeValue = offer?.transitTime || transitTime;
        const rateValue = offer?.profit?.amount ?? offer?.rate ?? rateAmount;
        const rateCurrencyValue = offer?.profit?.currency || offer?.rateCurrency || rateCurrency;
        const weightValue =
          typeof offer?.grossWeight === 'number' && Number.isFinite(offer.grossWeight)
            ? offer.grossWeight
            : sizeSummary.weight;
        const dimensionsValue = computeDimensionsCbm(offer) ?? sizeSummary.cbm;

        return {
          key: offer.id || `offer-${index}`,
          title,
          number: numberValue || '-',
          transportMode: transportModeValue || '-',
          route: routeValue || '-',
          shipmentCondition: shipmentConditionValue || '-',
          transitTime: transitTimeValue || '-',
          rate: formatAmountWithCurrency(rateValue, rateCurrencyValue),
          grossWeight: formatWeight(weightValue),
          dimensions: formatCbm(dimensionsValue),
        };
      });
    }

    return [
      {
        key: 'primary-offer',
        title: `${copy.rateTable.offerTitle} 1`,
        number: quotationNo || '-',
        transportMode: quotation?.tmode || quotation?.cargoType || '-',
        route: transportRoute || '-',
        shipmentCondition: quotation?.incoterm || quotation?.condition || '-',
        transitTime: transitTime || '-',
        rate: formatAmountWithCurrency(rateAmount, rateCurrency),
        grossWeight: formatWeight(sizeSummary.weight),
        dimensions: formatCbm(sizeSummary.cbm),
      },
    ];
  }, [
    copy.rateTable.offerTitle,
    quotationNo,
    quotation?.tmode,
    quotation?.cargoType,
    quotation?.incoterm,
    quotation?.condition,
    rateAmount,
    rateCurrency,
    sizeSummary.weight,
    sizeSummary.cbm,
    sortedOffers,
    transportRoute,
    transitTime,
  ]);

  return (
    <div className="print-wrapper">
      <style jsx>{`
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
          font-family: 'Times New Roman', Times, serif;
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
        .divider-image {
          width: 100%;
          height: auto;
          display: block;
        }

        .footer-logos {
          width: 50%;
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
          font-size: 8px;
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
          <label className="flex items-center gap-2 rounded border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-[#0b2b55] shadow-sm">
            <span>{copy.languageLabel}</span>
            <select
              className="rounded border border-blue-200 px-1.5 py-0.5 text-xs font-semibold text-[#0b2b55]"
              value={language}
              onChange={(event) => setLanguage(event.target.value as PrintLanguage)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow"
            onClick={() => window.print()}
          >
            {copy.printButton}
          </button>
        </div>

        {loading ? (
          <div className="grid flex-1 place-items-center text-sm text-[#0b2b55]">
            {copy.loading}
          </div>
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
              </div>

              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-label">{copy.meta.customerName}</span>
                  <span className="meta-value">{consignee}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{copy.meta.date}</span>
                  <span className="meta-value">{issuedDate}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{copy.meta.validDate}</span>
                  <span className="meta-value">{validDate}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{copy.meta.number}</span>
                  <span className="meta-value">{quotationNo}</span>
                </div>
              </div>

              <img src="/line.png" alt="Section divider" className="divider-image" />
            </header>

            <main className="content-section">
              <section>
                <p className="summary-line">
                  {copy.summary(sizeSummary.quantity, sizeSummary.weight, sizeSummary.cbm)}
                </p>
                <p className="summary-sub">
                  {copy.pickupLabel}: {pickupAddress}
                </p>
                <p className="summary-sub">
                  {copy.deliveryLabel}: {deliveryAddress}
                </p>
              </section>

              <section>
                <table className="rates-table">
                  <thead>
                    <tr>
                      <th>{copy.rateTable.offerTitle}</th>
                      <th>{copy.rateTable.offerNumber}</th>
                      <th>{copy.rateTable.transportMode}</th>
                      <th>{copy.rateTable.route}</th>
                      <th>{copy.rateTable.shipmentCondition}</th>
                      <th>{copy.rateTable.transitTime}</th>
                      <th>{copy.rateTable.rate}</th>
                      <th>{copy.rateTable.grossWeight}</th>
                      <th>{copy.rateTable.dimensions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerRows.map((row) => (
                      <tr key={row.key}>
                        <td>{row.title}</td>
                        <td>{row.number}</td>
                        <td>{row.transportMode}</td>
                        <td>{row.route}</td>
                        <td>{row.shipmentCondition}</td>
                        <td>{row.transitTime}</td>
                        <td>{row.rate}</td>
                        <td>{row.grossWeight}</td>
                        <td>{row.dimensions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="list-block">
                <div className="section-title">{copy.includesTitle}</div>
                {includes.length > 0 && (
                  <ul>
                    {includes.map((item, index) => (
                      <li key={`included-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="list-block">
                <div className="section-title">{copy.excludesTitle}</div>

                {excludes.length > 0 && (
                  <ul>
                    {excludes.map((item, index) => (
                      <li key={`excluded-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>

              {remarks.length > 0 && (
                <section className="list-block">
                  <div className="section-title">{copy.remarksTitle}</div>
                  <ul>
                    {remarks.map((item, index) => (
                      <li key={`remark-${index}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </main>

            <footer className="footer">
              <p>{copy.footerMessage}</p>
              <img src="/logos.png" alt="Tuushin certifications" className="footer-logos" />
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
