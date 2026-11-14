import { useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { signIn, type SessionUser } from '../services/api';
import { BrandLogo } from './BrandLogo';

interface LoginScreenProps {
  onSignedIn: (user: SessionUser) => void;
}

// Studio accent is hardcoded on purpose: brand settings sit behind the guard,
// so they cannot (and should not) be fetched before sign-in.
export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setPending(true);
    const result = await signIn(email.trim(), password);
    setPending(false);

    if (result.ok) {
      onSignedIn(result.user);
      return;
    }
    setError(result.error);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#111315] flex flex-col">
      <div className="flex-1 grid place-items-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-3 mb-8">
            <BrandLogo variant="draft" size={40} />
            <div>
              <p className="font-display text-lg font-bold tracking-tight leading-none">
                Mitemshub
              </p>
              <p className="text-[11px] text-[#5A6065] mt-1">Billing Studio</p>
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E0] rounded-2xl p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_12px_28px_-18px_rgba(17,19,21,0.28)]">
            <h1 className="font-display text-xl font-bold tracking-tight">
              Sign in to your ledger
            </h1>
            <p className="text-sm text-[#5A6065] mt-1.5 leading-relaxed">
              Invoices, client contacts, and payout accounts are only visible to your studio
              account.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-[#3A4045] mb-1.5"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#D8D8D2] bg-white text-sm text-[#111315] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B3B91]/25 focus:border-[#0B3B91]"
                  placeholder="you@mitemshub.studio"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-[#3A4045] mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#D8D8D2] bg-white text-sm text-[#111315] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B3B91]/25 focus:border-[#0B3B91]"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="text-xs text-[#B91C1C] bg-[#B91C1C]/6 border border-[#B91C1C]/20 rounded-lg px-3 py-2"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B3B91] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{pending ? 'Signing in…' : 'Sign in'}</span>
                {!pending && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
              </button>
            </form>

            <p className="flex items-start gap-2 text-[11px] text-[#5A6065] mt-5 leading-relaxed">
              <LockKeyhole className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Sign in with the Mitemshub account created in your Appwrite project.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
