import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, Shield, User } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import supabase from '../lib/supabase';

export default function Account() {
  const { user, session } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busyPw, setBusyPw] = useState(false);
  const [errPw, setErrPw] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [busyEmail, setBusyEmail] = useState(false);
  const [errEmail, setErrEmail] = useState('');

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setErrPw('');
    if (pw.length < 6) {
      setErrPw('Password must be at least 6 characters.');
      return;
    }
    if (pw !== pw2) {
      setErrPw('Passwords do not match.');
      return;
    }
    setBusyPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw('');
      setPw2('');
      toast.ok('Password updated');
    } catch (err: unknown) {
      setErrPw(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setBusyPw(false);
    }
  };

  const changeEmail = async (e: FormEvent) => {
    e.preventDefault();
    setErrEmail('');
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setErrEmail('Enter a valid email.');
      return;
    }
    if (next === user?.email) {
      setErrEmail('That is already your email.');
      return;
    }
    setBusyEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast.ok('Email update requested. Check your inbox if confirmation is required.');
    } catch (err: unknown) {
      setErrEmail(err instanceof Error ? err.message : 'Could not update email');
    } finally {
      setBusyEmail(false);
    }
  };

  const created = user?.created_at ? new Date(user.created_at).toLocaleString() : '—';
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—';

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-2xl px-5 py-12 md:px-8">
        <Link to="/dashboard" className="text-xs uppercase tracking-wider text-ink/40 hover:text-ink">
          ← Studio
        </Link>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-sage">Account</p>
        <h1 className="mt-1 font-display text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-ink-soft/70">Manage your organiser login. Participants never need an account.</p>

        <section className="mt-8 rounded-[2rem] bg-cream p-6 ring-1 ring-ink/8 md:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-moss/10 text-moss">
              <User size={18} />
            </span>
            <div>
              <h2 className="font-display text-2xl">Profile</h2>
              <p className="mt-1 text-sm text-ink-soft/65">Signed in as organiser</p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-ink/6 pb-2">
              <dt className="text-ink/45">Email</dt>
              <dd className="font-medium">{user?.email || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ink/6 pb-2">
              <dt className="text-ink/45">User id</dt>
              <dd className="max-w-[60%] truncate font-mono text-xs">{user?.id || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ink/6 pb-2">
              <dt className="text-ink/45">Created</dt>
              <dd>{created}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/45">Last sign-in</dt>
              <dd>{lastSignIn}</dd>
            </div>
          </dl>
          {session?.expires_at ? (
            <p className="mt-4 text-[11px] text-ink/40">
              Session expires {new Date(session.expires_at * 1000).toLocaleString()}
            </p>
          ) : null}
        </section>

        <section className="mt-6 rounded-[2rem] bg-cream p-6 ring-1 ring-ink/8 md:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-moss/10 text-moss">
              <Mail size={18} />
            </span>
            <div>
              <h2 className="font-display text-2xl">Change email</h2>
              <p className="mt-1 text-sm text-ink-soft/65">
                If your project has email confirmation on, Supabase may email the new address before it sticks.
              </p>
            </div>
          </div>
          <form onSubmit={changeEmail} className="mt-5 space-y-3">
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errEmail && <p className="text-sm text-terra">{errEmail}</p>}
            <button type="submit" disabled={busyEmail} className="btn-primary disabled:opacity-60">
              {busyEmail ? 'Saving…' : 'Update email'}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-[2rem] bg-cream p-6 ring-1 ring-ink/8 md:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-moss/10 text-moss">
              <KeyRound size={18} />
            </span>
            <div>
              <h2 className="font-display text-2xl">Change password</h2>
              <p className="mt-1 text-sm text-ink-soft/65">Use at least 6 characters. You’ll stay signed in after the change.</p>
            </div>
          </div>
          <form onSubmit={changePassword} className="mt-5 space-y-3">
            <input
              type="password"
              className="input-field"
              placeholder="New password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
            <input
              type="password"
              className="input-field"
              placeholder="Confirm new password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
            {errPw && <p className="text-sm text-terra">{errPw}</p>}
            <button type="submit" disabled={busyPw} className="btn-primary disabled:opacity-60">
              {busyPw ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-[2rem] bg-ink p-6 text-cream md:p-8">
          <div className="flex items-start gap-3">
            <Shield size={18} className="mt-1 text-gold" />
            <div>
              <h2 className="font-display text-2xl">Security notes</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-cream/75">
                <li>Never share your password. Organiser access can edit and export claims.</li>
                <li>The service role key belongs only on the Cloudflare Worker — never in the browser.</li>
                <li>
                  Prefer a unique password. You can sign out from any device via this page after a password change on
                  shared machines.
                </li>
              </ul>
              <button type="button" onClick={() => supabase.auth.signOut()} className="mt-5 rounded-full border border-cream/25 px-4 py-2 text-sm">
                Sign out everywhere (this browser)
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
