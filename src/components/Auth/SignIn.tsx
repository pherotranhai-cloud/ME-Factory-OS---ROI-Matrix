import React from 'react';
import { Loader2, AlertCircle, LogIn, UserPlus, MailCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';

/**
 * Sign-in and sign-up on one screen.
 *
 * A new account always arrives as `user` — the role comes from the database
 * column default, so nothing typed here can grant privileges. Admins are
 * promoted by editing `public.users` in Supabase.
 */
export const SignIn: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmSent, setConfirmSent] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setConfirmSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-[24px] border border-[#006D77]/20 bg-white/80 p-8 text-center shadow-[0_8px_32px_rgba(0,109,119,0.1)]">
        <MailCheck size={32} className="mx-auto text-[#006D77] mb-3" />
        <h2 className="text-lg font-black text-[#002D32] mb-2">Check your email</h2>
        <p className="text-[13px] text-[#4A6B6F] leading-relaxed">
          We sent a confirmation link to <strong>{email}</strong>. Open it, then come back and
          sign in.
        </p>
        <button
          type="button"
          onClick={() => { setConfirmSent(false); setMode('signin'); }}
          className="mt-5 text-[12px] font-bold text-[#006D77] hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 rounded-[24px] border border-[#006D77]/20 bg-white/80 p-8 shadow-[0_8px_32px_rgba(0,109,119,0.1)]">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#006D77] mb-1">
        LY ROI Matrix
      </div>
      <h2 className="text-xl font-black text-[#002D32] mb-1">
        {mode === 'signin' ? 'Sign in' : 'Create an account'}
      </h2>
      <p className="text-[12px] text-[#4A6B6F] mb-6 leading-relaxed">
        {mode === 'signin'
          ? 'Reports and data entry require an account. The dashboard totals are open to everyone.'
          : 'New accounts can create and edit their own reports. An administrator grants anything beyond that.'}
      </p>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B6F]">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#006D77]/20 bg-white px-3 py-2.5 text-[14px] text-[#002D32] focus:outline-none focus:ring-2 focus:ring-[#006D77]/30"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B6F]">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#006D77]/20 bg-white px-3 py-2.5 text-[14px] text-[#002D32] focus:outline-none focus:ring-2 focus:ring-[#006D77]/30"
          />
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
            <span className="text-[12px] text-red-800 leading-snug">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#006D77] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#005259] disabled:opacity-50"
        >
          {busy
            ? <><Loader2 size={15} className="animate-spin" /> Working…</>
            : mode === 'signin'
              ? <><LogIn size={15} /> Sign in</>
              : <><UserPlus size={15} /> Create account</>}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-[12px]">
        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
          className="font-bold text-[#006D77] hover:underline"
        >
          {mode === 'signin' ? 'Create an account' : 'I already have an account'}
        </button>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-[#4A6B6F] hover:underline">
            View public dashboard
          </button>
        )}
      </div>
    </div>
  );
};
