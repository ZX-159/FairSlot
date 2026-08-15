import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function JoinEvent() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError('Enter the 6-character join code from your organiser.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/public?code=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Event not found');
      navigate(`/e/${c}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Event not found');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-col px-5 py-20 md:px-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] bg-cream p-8 ring-1 ring-ink/8 md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-sage">Participants</p>
          <h1 className="mt-2 font-display text-4xl">Join with a code</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft/75">
            No account. No app. Type the code from your organiser — or open the share link they sent you — and claim a slot.
          </p>
          <form onSubmit={go} className="mt-8 space-y-4">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input-field text-center font-mono text-2xl tracking-[0.35em]"
              placeholder="ABCDEF"
              maxLength={8}
              autoFocus
            />
            {error && <p className="text-sm text-terra">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? 'Looking…' : 'Open event'}
            </button>
          </form>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
