import { useRef, useState } from 'react';
import { Check, Download, Trash2, Upload } from 'lucide-react';
import type { BrandSettings, Client, Invoice } from '../types/billing';
import { BrandLogo, DRAFT_LOGO_PATH } from '../components/BrandLogo';
import { InvoicePaper } from '../components/InvoicePaper';

interface BrandStudioViewProps {
  brand: BrandSettings;
  sampleInvoice: Invoice;
  sampleClient?: Client;
  onUpdateBrand: (next: BrandSettings) => void;
}

const ACCENT_PRESETS = [
  { name: 'Mitemshub Royal', hex: '#0B3B91' },
  { name: 'Electric Cobalt', hex: '#0044FF' },
  { name: 'Studio Emerald', hex: '#0F5C4D' },
  { name: 'Graphite Ink', hex: '#111315' },
  { name: 'Copper Amber', hex: '#9A3412' },
];

export function BrandStudioView({
  brand,
  sampleInvoice,
  sampleClient,
  onUpdateBrand,
}: BrandStudioViewProps) {
  const [savedNotice, setSavedNotice] = useState(false);
  const [mobileTab, setMobileTab] = useState<'settings' | 'preview'>('settings');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const update = (patch: Partial<BrandSettings>) => {
    onUpdateBrand({ ...brand, ...patch });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleDownloadActiveLogo = () => {
    const link = document.createElement('a');
    if (brand.logoVariant === 'custom' && brand.customLogoDataUrl) {
      link.href = brand.customLogoDataUrl;
      const mimeMatch = /^data:image\/([a-z0-9+.-]+);/i.exec(brand.customLogoDataUrl);
      const ext = mimeMatch ? mimeMatch[1].replace('svg+xml', 'svg') : 'png';
      link.download = `mitemshub-custom-logo.${ext}`;
    } else {
      link.href = DRAFT_LOGO_PATH;
      link.download = 'mitemshub-logo-draft.png';
    }
    link.click();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update({ logoVariant: 'custom', customLogoDataUrl: reader.result });
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveUploadedLogo = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    update({
      customLogoDataUrl: undefined,
      logoVariant: 'draft',
    });
  };

  return (
    <div className="space-y-4">
      <div className="lg:hidden inline-flex items-center gap-1 p-1 bg-[#EAEAE4] rounded-lg">
        <button
          type="button"
          onClick={() => setMobileTab('settings')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            mobileTab === 'settings' ? 'bg-white text-[#111315] shadow-xs' : 'text-[#5A6065]'
          }`}
        >
          Brand Settings
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            mobileTab === 'preview' ? 'bg-white text-[#111315] shadow-xs' : 'text-[#5A6065]'
          }`}
        >
          Live Preview
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 cols: Brand & Logo Controls */}
        <div
          className={`lg:col-span-5 min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-6 space-y-6 ${
            mobileTab === 'preview' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#E5E5E0]">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-[#111315]">
                Mitemshub Identity &amp; Logo Studio
              </h2>
              <p className="text-xs text-[#5A6065] mt-0.5">
                Use your Original Draft (PNG) mark or upload a custom logo, palette, and payout accounts
              </p>
            </div>
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D] shrink-0">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Synced</span>
              </span>
            )}
          </div>

          {/* Logo Mark Picker */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#111315]">Mitemshub Logo Mark</span>
              <button
                type="button"
                onClick={handleDownloadActiveLogo}
                className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                style={{ color: brand.accentColor }}
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download Logo (PNG)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => update({ logoVariant: 'draft' })}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  brand.logoVariant !== 'custom'
                    ? 'border-[#111315] bg-[#F7F7F5]'
                    : 'border-[#E5E5E0] bg-white hover:bg-[#F7F7F5]/60'
                }`}
              >
                <BrandLogo variant="draft" accentColor={brand.accentColor} size={40} />
                <p className="text-xs font-semibold text-[#111315] mt-2.5">
                  Original Draft (PNG)
                </p>
                <p className="text-[11px] text-[#5A6065] mt-0.5 leading-snug">
                  Your M-orbit studio mark used across invoices &amp; headers
                </p>
              </button>

              {brand.customLogoDataUrl && (
                <div
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    brand.logoVariant === 'custom'
                      ? 'border-[#111315] bg-[#F7F7F5]'
                      : 'border-[#E5E5E0] bg-white hover:bg-[#F7F7F5]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => update({ logoVariant: 'custom' })}
                      className="text-left focus:outline-none"
                      aria-label="Select Uploaded Custom Logo"
                    >
                      <BrandLogo
                        variant="custom"
                        accentColor={brand.accentColor}
                        customLogoDataUrl={brand.customLogoDataUrl}
                        size={40}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveUploadedLogo}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                      aria-label="Remove Uploaded Logo"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => update({ logoVariant: 'custom' })}
                    className="block w-full text-left mt-2.5"
                  >
                    <p className="text-xs font-semibold text-[#111315]">Uploaded Custom Logo</p>
                    <p className="text-[11px] text-[#5A6065] mt-0.5 leading-snug">
                      Custom brand mark saved to your studio settings
                    </p>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#F7F7F5] cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{brand.customLogoDataUrl ? 'Replace Custom Logo' : 'Upload Custom Logo'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="sr-only"
                />
              </label>
              {brand.customLogoDataUrl && (
                <button
                  type="button"
                  onClick={handleRemoveUploadedLogo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs font-medium text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove Uploaded Image</span>
                </button>
              )}
            </div>
          </div>

          {/* Brand Accent Color */}
          <div className="pt-4 border-t border-[#E5E5E0] space-y-2.5">
            <span className="block text-xs font-semibold text-[#111315]">Brand Accent Color</span>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => update({ accentColor: preset.hex })}
                  aria-label={`Select ${preset.name} (${preset.hex})`}
                  title={preset.name}
                  className={`w-8 h-8 rounded-lg border transition-transform ${
                    brand.accentColor.toLowerCase() === preset.hex.toLowerCase()
                      ? 'scale-110 ring-2 ring-offset-2 ring-[#111315]'
                      : 'border-[#E5E5E0]'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
              <label className="inline-flex items-center gap-2 text-xs text-[#5A6065] ml-0 sm:ml-1">
                <span>Custom</span>
                <input
                  type="color"
                  value={brand.accentColor}
                  onChange={(e) => update({ accentColor: e.target.value })}
                  aria-label="Custom brand accent hex color"
                  className="w-8 h-8 rounded border border-[#E5E5E0] cursor-pointer bg-white"
                />
              </label>
            </div>
          </div>

          {/* Studio Details */}
          <div className="pt-4 border-t border-[#E5E5E0] space-y-3.5">
            <p className="text-xs font-semibold text-[#111315]">Studio Profile</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="br-name" className="block text-xs font-medium text-[#111315] mb-1">
                  Business Name
                </label>
                <input
                  id="br-name"
                  type="text"
                  value={brand.businessName}
                  onChange={(e) => update({ businessName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                />
              </div>
              <div>
                <label htmlFor="br-owner" className="block text-xs font-medium text-[#111315] mb-1">
                  Owner / Lead
                </label>
                <input
                  id="br-owner"
                  type="text"
                  value={brand.ownerName}
                  onChange={(e) => update({ ownerName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="br-tagline" className="block text-xs font-medium text-[#111315] mb-1">
                Specialty Tagline
              </label>
              <input
                id="br-tagline"
                type="text"
                value={brand.tagline}
                onChange={(e) => update({ tagline: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="br-email" className="block text-xs font-medium text-[#111315] mb-1">
                  Billing Email
                </label>
                <input
                  id="br-email"
                  type="email"
                  value={brand.email}
                  onChange={(e) => update({ email: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                />
              </div>
              <div>
                <label htmlFor="br-phone" className="block text-xs font-medium text-[#111315] mb-1">
                  Phone
                </label>
                <input
                  id="br-phone"
                  type="text"
                  value={brand.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="br-address" className="block text-xs font-medium text-[#111315] mb-1">
                  Studio Address
                </label>
                <input
                  id="br-address"
                  type="text"
                  value={brand.address}
                  onChange={(e) => update({ address: e.target.value })}
                  placeholder="Street, City, Country"
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                />
              </div>
              <div>
                <label htmlFor="br-website" className="block text-xs font-medium text-[#111315] mb-1">
                  Website
                </label>
                <input
                  id="br-website"
                  type="text"
                  value={brand.website}
                  onChange={(e) => update({ website: e.target.value })}
                  placeholder="mitemshub.studio"
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="br-rate" className="block text-xs font-medium text-[#111315] mb-1">
                  Default USD → NGN Rate
                </label>
                <input
                  id="br-rate"
                  type="number"
                  min={1}
                  step="0.5"
                  value={brand.defaultUsdToNgnRate}
                  onChange={(e) => update({ defaultUsdToNgnRate: Number(e.target.value) || 1600 })}
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="br-tax" className="block text-xs font-medium text-[#111315] mb-1">
                  Tax / TIN Reference
                </label>
                <input
                  id="br-tax"
                  type="text"
                  value={brand.taxId}
                  onChange={(e) => update({ taxId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Settlement Accounts */}
          <div className="pt-4 border-t border-[#E5E5E0] space-y-3">
            <p className="text-xs font-semibold text-[#111315]">
              Dual-Currency Payout Instructions
            </p>
            <div>
              <label htmlFor="br-usd" className="block text-xs font-medium text-[#111315] mb-1">
                USD Bank / Wire Instructions
              </label>
              <textarea
                id="br-usd"
                rows={4}
                value={brand.usdBankDetails}
                onChange={(e) => update({ usdBankDetails: e.target.value })}
                className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="br-ngn" className="block text-xs font-medium text-[#111315] mb-1">
                NGN Bank Transfer Instructions
              </label>
              <textarea
                id="br-ngn"
                rows={4}
                value={brand.ngnBankDetails}
                onChange={(e) => update({ ngnBankDetails: e.target.value })}
                className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Right 7 cols: Live Branded Stationery Preview */}
        <div
          className={`lg:col-span-7 min-w-0 space-y-3 ${
            mobileTab === 'settings' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A6065]">
            <span>Live Stationery Preview</span>
            <span>Updates automatically across all Mitemshub invoices</span>
          </div>
          <InvoicePaper invoice={sampleInvoice} client={sampleClient} brand={brand} compact />
        </div>
      </div>
    </div>
  );
}
