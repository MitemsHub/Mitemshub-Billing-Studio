import {
  FileText,
  LayoutDashboard,
  Palette,
  Repeat,
  Users,
  X,
  Download,
  LogOut,
} from 'lucide-react';
import type { BrandSettings } from '../types/billing';
import { BrandLogo } from './BrandLogo';

export type NavSection = 'overview' | 'invoices' | 'clients' | 'automation' | 'branding';

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  brand: BrandSettings;
  overdueCount: number;
  dueRemindersCount: number;
  onExportBackup: () => void;
  user?: { name: string; email: string } | null;
  onSignOut?: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', Icon: FileText },
  { id: 'clients', label: 'Clients', Icon: Users },
  { id: 'automation', label: 'Recurring & Alerts', Icon: Repeat },
  { id: 'branding', label: 'Brand Studio', Icon: Palette },
];

export function Sidebar({
  activeSection,
  onNavigate,
  brand,
  overdueCount,
  dueRemindersCount,
  onExportBackup,
  user,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E5E5E0] w-[268px]">
      {/* Brand Lockup */}
      <div className="px-5 py-5 border-b border-[#E5E5E0] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo
            variant={brand.logoVariant}
            accentColor={brand.accentColor}
            customLogoDataUrl={brand.customLogoDataUrl}
            size={34}
          />
          <div className="min-w-0">
            <p className="font-display text-base font-bold tracking-tight text-[#111315] truncate">
              {brand.businessName}
            </p>
            <p className="text-[11px] text-[#5A6065] truncate">Billing Studio</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-md text-[#5A6065] hover:text-[#111315] hover:bg-[#F7F7F5]"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeSection === id;
          const countHint =
            id === 'invoices' && overdueCount > 0
              ? `${overdueCount} overdue`
              : id === 'automation' && dueRemindersCount > 0
              ? `${dueRemindersCount} due`
              : null;

          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onNavigate(id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#F0F0EC] text-[#111315]'
                  : 'text-[#5A6065] hover:text-[#111315] hover:bg-[#F7F7F5]'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={isActive ? { color: brand.accentColor } : undefined}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
              </span>
              {countHint && (
                <span className="text-[11px] font-mono tabular-nums text-[#B91C1C] font-medium shrink-0">
                  {countHint}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Studio Rate & Backup Footer */}
      <div className="p-4 border-t border-[#E5E5E0] space-y-3">
        <div className="text-xs space-y-1">
          <p className="text-[#5A6065]">Default FX Rate</p>
          <p className="font-mono font-semibold tabular-nums text-[#111315]">
            1 USD = ₦{brand.defaultUsdToNgnRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportBackup}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#F7F7F5] transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Export Backup JSON</span>
        </button>

        {user && onSignOut && (
          <div className="flex items-center gap-2 pt-1">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#111315] truncate">{user.name}</p>
              <p className="text-[11px] text-[#5A6065] truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="p-2 rounded-lg text-[#5A6065] hover:text-[#111315] hover:bg-[#F7F7F5] transition-colors shrink-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-screen shrink-0 no-print">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
}
