import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { parseJsonSafe } from '../lib/api';
import { isValidJoinCode, JOIN_CODE_MAX, JOIN_CODE_MIN, normalizeJoinCode } from '../lib/codes';

export default function JoinEvent() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e: FormEvent) => {
    e.preventDefault();
    const c = normalizeJoinCode(code);
    if (!isValidJoinCode(c)) {
      setError(`Enter the ${JOIN_CODE_MIN}–${JOIN_CODE_MAX} character magic code from your organiser.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/public?code=${encodeURIComponent(c)}`);
      const data = (await parseJsonSafe(res)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Event not found');
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] bg-cream p-8 ring-1 ring-ink/8 md:p-10"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-sage">Participants</p>
          <h1 className="mt-2 font-display text-4xl">Join with a code</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft/75">
            No account. Paste the magic code from your organiser — or open the share link they sent you —
            and claim a slot.
          </p>
          <form onSubmit={go} className="mt-8 space-y-4">
            <input
              value={code}
              onChange={(e) => setCode(normalizeJoinCode(e.target.value).slice(0, JOIN_CODE_MAX))}
              className="input-field text-center font-mono text-xl tracking-[0.28em] sm:text-2xl"
              placeholder="A7K3M9Q2XP"
              maxLength={JOIN_CODE_MAX}
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-center text-[11px] text-ink/40">
              Codes are {JOIN_CODE_MIN}–{JOIN_CODE_MAX} characters (usually 10).
            </p>
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
