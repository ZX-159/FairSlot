import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-ink/8 bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <span className="inline-flex items-center gap-2">
            <Logo light />
          </span>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/65">
            Frictionless event allocation. Live inventory, immutable locks, and a tidy CSV — without chat chaos or spreadsheet archaeology.
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold/80">For everyone</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-cream/75">
            <Link to="/events" className="hover:text-cream">Browse open events</Link>
            <Link to="/join" className="hover:text-cream">Join with a code</Link>
            <Link to="/login" className="hover:text-cream">Creator studio</Link>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold/80">The promise</p>
          <ul className="mt-4 space-y-2 text-sm text-cream/75">
            <li>Zero-login for participants</li>
            <li>Instant live inventory</li>
            <li>Immutable locking</li>
            <li>Tidy CSV exports</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 px-5 py-5 text-center text-xs text-cream/40">
        FairSlot · Built for organisers · Powered by a quiet, real-time ledger
      </div>
    </footer>
  );
}
