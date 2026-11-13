import type { LogoVariant } from '../types/billing';

export const DRAFT_LOGO_PATH =
  '/assets/aistudio/dd3a3da2-677d-44b6-8c03-01745c6efb29-removebg-preview_bc41b6f6.png';

interface BrandLogoProps {
  variant: LogoVariant;
  accentColor?: string;
  customLogoDataUrl?: string;
  size?: number;
  className?: string;
}

export function BrandLogo({
  variant,
  customLogoDataUrl,
  size = 36,
  className = '',
}: BrandLogoProps) {
  if (variant === 'custom' && customLogoDataUrl) {
    return (
      <img
        src={customLogoDataUrl}
        alt="Mitemshub custom brand logo"
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        className={`rounded-lg object-contain shrink-0 bg-white border border-[#E5E5E0] p-0.5 ${className}`}
      />
    );
  }

  return (
    <img
      src={DRAFT_LOGO_PATH}
      alt="Mitemshub Original Draft logo"
      referrerPolicy="no-referrer"
      style={{ width: size, height: size }}
      className={`rounded-lg object-contain shrink-0 bg-white border border-[#E5E5E0] p-0.5 ${className}`}
    />
  );
}
