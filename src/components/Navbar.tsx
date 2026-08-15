import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `text-sm tracking-wide transition-colors ${isActive ? 'text-ink' : 'text-ink-soft/70 hover:text-ink'}`;

export default function Navbar({ variant = 'light' }: { variant?: 'light' | 'overlay' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const overlay = variant === 'overlay';

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className={`relative z-40 ${overlay ? 'absolute inset-x-0 top-0' : 'bg-parchment/80 backdrop-blur-md border-b border-ink/5'}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <NavLink to="/events" className={linkCls}>
            Open events
          </NavLink>
          <NavLink to="/join" className={linkCls}>
            Join with code
          </NavLink>
          {user ? (
            <NavLink to="/dashboard" className={linkCls}>
              Studio
            </NavLink>
          ) : null}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="text-xs text-ink-soft/60 max-w-[160px] truncate">{user.email}</span>
              <button
                onClick={signOut}
                className="text-sm text-ink-soft/70 hover:text-ink transition-colors"
              >
                Sign out
              </button>
              <Link to="/events/new" className="btn-primary text-sm px-4 py-2">
                New event
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-ink-soft/80 hover:text-ink">
                Sign in
              </Link>
              <Link to="/login" className="btn-primary text-sm px-4 py-2">
                Create event
              </Link>
            </>
          )}
        </div>
        <button className="md:hidden p-2 text-ink" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-ink/5 bg-cream"
          >
            <div className="flex flex-col gap-4 px-5 py-5">
              <Link to="/events" onClick={() => setOpen(false)} className="text-ink">
                Open events
              </Link>
              <Link to="/join" onClick={() => setOpen(false)} className="text-ink">
                Join with code
              </Link>
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="text-ink">
                    Studio
                  </Link>
                  <Link to="/events/new" onClick={() => setOpen(false)} className="btn-primary text-center">
                    New event
                  </Link>
                  <button onClick={signOut} className="text-left text-ink-soft/70">
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)} className="btn-primary text-center">
                  Create event
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
