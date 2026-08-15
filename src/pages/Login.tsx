import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';

export default function Login() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim() || password.length < 6) {
      setError('Use a valid email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'up') {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        setNotice('Account created. You can sign in now.');
        setMode('in');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not authenticate');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/images/classroom.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/20" />
        <div className="relative flex h-full flex-col justify-between p-10 text-cream">
          <Link to="/">
            <Logo light />
          </Link>
          <div>
            <p className="font-display text-4xl leading-tight">The quiet ledger behind a busy sign-up.</p>
            <p className="mt-4 max-w-sm text-sm text-cream/70">
              Sign in with email to compose events, watch inventory fill, lock the book, and export a tidy CSV.
            </p>
          </div>
        </div>
      </div>
      <div className="flex min-h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="lg:hidden">
            <Logo />
          </Link>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
            <p className="text-xs uppercase tracking-[0.2em] text-sage">Creator studio</p>
            <h1 className="mt-2 font-display text-4xl">{mode === 'in' ? 'Welcome back' : 'Open an account'}</h1>
            <p className="mt-2 text-sm text-ink-soft/70">
              Participants never need this. This door is only for organisers.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/50">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@organisation.com"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/50">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                />
              </label>
              {error && <p className="rounded-xl bg-terra/10 px-3 py-2 text-sm text-terra">{error}</p>}
              {notice && <p className="rounded-xl bg-moss/10 px-3 py-2 text-sm text-moss">{notice}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
                {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-ink-soft/70">
              {mode === 'in' ? 'New organiser?' : 'Already have an account?'}
              <button
                className="ml-2 text-ink underline decoration-gold/60 underline-offset-4"
                onClick={() => {
                  setMode(mode === 'in' ? 'up' : 'in');
                  setError('');
                }}
              >
                {mode === 'in' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
