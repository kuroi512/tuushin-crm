'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Plus, Edit2 } from 'lucide-react';
import { formatOfferNumber } from '@/lib/quotations/offer-helpers';
import type { QuotationOffer } from '@/types/quotation';

// Simple UUID generator for browser
const generateId = () => 'offer_' + Math.random().toString(36).substr(2, 9);

export interface OfferTabsProps {
  offers: QuotationOffer[];
  onChange: (offers: QuotationOffer[]) => void;
  className?: string;
}

export function OfferTabs({ offers, onChange, className }: OfferTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  const parseNumberInput = (value: string): number | undefined => {
    if (value === '' || value === undefined || value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const addOffer = () => {
    const newOffer: QuotationOffer = {
      id: generateId(),
      quotationId: '',
      title: `Offer ${offers.length + 1}`,
      order: offers.length,
      offerNumber: formatOfferNumber(offers.length),
      transportMode: '',
      routeSummary: '',
      shipmentCondition: '',
      transitTime: '',
      rate: undefined,
      rateCurrency: 'USD',
      grossWeight: undefined,
      dimensionsCbm: undefined,
      notes: '',
    };

    const updatedOffers = [...offers, newOffer];
    onChange(updatedOffers);
    setActiveTab(updatedOffers.length - 1);
  };

  const removeOffer = (index: number) => {
    if (offers.length <= 1) return; // Keep at least one offer

    const updatedOffers = offers.filter((_, i) => i !== index);
    onChange(updatedOffers);

    // Adjust active tab if necessary
    if (activeTab >= updatedOffers.length) {
      setActiveTab(Math.max(0, updatedOffers.length - 1));
    } else if (activeTab > index) {
      setActiveTab(activeTab - 1);
    }
  };

  const updateOffer = (index: number, updates: Partial<QuotationOffer>) => {
    const updatedOffers = offers.map((offer, i) =>
      i === index ? { ...offer, ...updates } : offer,
    );
    onChange(updatedOffers);
  };

  const currentOffer = offers[activeTab] || offers[0];

  return (
    <div className={className}>
      {/* Tab Headers */}
      <div className="mb-4 flex items-center gap-2 border-b">
        {offers.map((offer, index) => (
          <div key={offer.id} className="flex items-center">
            <button
              onClick={() => setActiveTab(index)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === index
                  ? 'border-b-2 border-blue-700 bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {offer.title || `Offer ${index + 1}`}
            </button>
            {offers.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeOffer(index)}
                className="ml-1 h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addOffer} className="ml-2">
          <Plus className="mr-1 h-4 w-4" />
          Add Offer
        </Button>
      </div>

      {/* Tab Content */}
      {currentOffer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              {currentOffer.title || `Offer ${activeTab + 1}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor={`offer-title-${activeTab}`}>Offer Title</Label>
                <Input
                  id={`offer-title-${activeTab}`}
                  value={currentOffer.title || ''}
                  onChange={(e) => updateOffer(activeTab, { title: e.target.value })}
                  placeholder="Enter offer title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`offer-number-${activeTab}`}>Offer Number</Label>
                <Input
                  id={`offer-number-${activeTab}`}
                  value={currentOffer.offerNumber ?? formatOfferNumber(activeTab)}
                  onChange={(e) => updateOffer(activeTab, { offerNumber: e.target.value })}
                  placeholder={formatOfferNumber(activeTab)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`transport-mode-${activeTab}`}>Transport Mode</Label>
                <Input
                  id={`transport-mode-${activeTab}`}
                  value={currentOffer.transportMode || ''}
                  onChange={(e) => updateOffer(activeTab, { transportMode: e.target.value })}
                  placeholder="e.g., 20ft Container, Truck"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`transit-time-${activeTab}`}>Transit Time</Label>
                <Input
                  id={`transit-time-${activeTab}`}
                  value={currentOffer.transitTime || ''}
                  onChange={(e) => updateOffer(activeTab, { transitTime: e.target.value })}
                  placeholder="e.g., 7-10 days"
                />
              </div>

              {/* Pricing */}
              <div className="space-y-2">
                <Label htmlFor={`rate-${activeTab}`}>Rate</Label>
                <Input
                  id={`rate-${activeTab}`}
                  type="number"
                  step="0.01"
                  value={currentOffer.rate ?? ''}
                  onChange={(e) =>
                    updateOffer(activeTab, {
                      rate: parseNumberInput(e.target.value),
                    })
                  }
                  placeholder="Enter rate amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`rate-currency-${activeTab}`}>Currency</Label>
                <select
                  id={`rate-currency-${activeTab}`}
                  value={currentOffer.rateCurrency || 'USD'}
                  onChange={(e) => updateOffer(activeTab, { rateCurrency: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                  <option value="MNT">MNT</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              {/* Physical Details */}
              <div className="space-y-2">
                <Label htmlFor={`gross-weight-${activeTab}`}>Gross Weight (kg)</Label>
                <Input
                  id={`gross-weight-${activeTab}`}
                  type="number"
                  step="0.01"
                  value={currentOffer.grossWeight ?? ''}
                  onChange={(e) =>
                    updateOffer(activeTab, {
                      grossWeight: parseNumberInput(e.target.value),
                    })
                  }
                  placeholder="Enter gross weight"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`dimensions-cbm-${activeTab}`}>Dimensions (CBM)</Label>
                <Input
                  id={`dimensions-cbm-${activeTab}`}
                  type="number"
                  step="0.001"
                  value={currentOffer.dimensionsCbm ?? ''}
                  onChange={(e) =>
                    updateOffer(activeTab, {
                      dimensionsCbm: parseNumberInput(e.target.value),
                    })
                  }
                  placeholder="Enter volume in CBM"
                />
              </div>
            </div>

            {/* Full-width fields */}
            <div className="space-y-2">
              <Label htmlFor={`route-summary-${activeTab}`}>Route Summary</Label>
              <Input
                id={`route-summary-${activeTab}`}
                value={currentOffer.routeSummary || ''}
                onChange={(e) => updateOffer(activeTab, { routeSummary: e.target.value })}
                placeholder="e.g., Ulaanbaatar → Tianjin Port"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`shipment-condition-${activeTab}`}>Shipment Condition</Label>
              <Input
                id={`shipment-condition-${activeTab}`}
                value={currentOffer.shipmentCondition || ''}
                onChange={(e) => updateOffer(activeTab, { shipmentCondition: e.target.value })}
                placeholder="Enter shipment conditions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`notes-${activeTab}`}>Notes</Label>
              <Textarea
                id={`notes-${activeTab}`}
                value={currentOffer.notes || ''}
                onChange={(e) => updateOffer(activeTab, { notes: e.target.value })}
                placeholder="Additional notes for this offer..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
