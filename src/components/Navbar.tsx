import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, LayoutDashboard, Plus, Settings, BookOpen, HelpCircle, LogOut, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `text-sm tracking-wide transition-colors ${isActive ? 'text-ink' : 'text-ink-soft/70 hover:text-ink'}`;

export default function Navbar({ variant = 'light' }: { variant?: 'light' | 'overlay' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const overlay = variant === 'overlay';

  // Close menus on route change
  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  // Click outside account menu
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Escape closes drawers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const signOut = async () => {
    setAccountOpen(false);
    setOpen(false);
    await supabase.auth.signOut();
    navigate('/');
  };

  const publicLinks = [
    { to: '/events', label: 'Open events' },
    { to: '/join', label: 'Join with code' },
    { to: '/guide', label: 'Creator guide' },
    { to: '/faq', label: 'FAQ' },
  ];

  return (
    <header
      className={`relative z-40 ${
        overlay ? 'absolute inset-x-0 top-0' : 'border-b border-ink/5 bg-parchment/80 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 md:px-8">
        <Link to="/" className="shrink-0 transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 lg:flex">
          {publicLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <NavLink to="/dashboard" className={linkCls}>
              Studio
            </NavLink>
          ) : null}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link to="/events/new" className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
                New event
              </Link>
              <div className="relative hidden sm:block" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-cream px-3 py-2 text-sm ring-1 ring-ink/8 transition hover:ring-moss/30"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-moss/15 text-moss">
                    <User size={14} />
                  </span>
                  <span className="truncate text-xs text-ink/70">{user.email}</span>
                  <ChevronDown size={14} className={`shrink-0 text-ink/40 transition ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl bg-cream py-1 shadow-xl ring-1 ring-ink/10"
                      role="menu"
                    >
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-parchment"
                        role="menuitem"
                      >
                        <LayoutDashboard size={15} /> Studio dashboard
                      </Link>
                      <Link
                        to="/events/new"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-parchment"
                        role="menuitem"
                      >
                        <Plus size={15} /> New event
                      </Link>
                      <Link
                        to="/account"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-parchment"
                        role="menuitem"
                      >
                        <Settings size={15} /> Account settings
                      </Link>
                      <Link
                        to="/guide"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-parchment"
                        role="menuitem"
                      >
                        <BookOpen size={15} /> Creator guide
                      </Link>
                      <div className="my-1 border-t border-ink/8" />
                      <button
                        type="button"
                        onClick={signOut}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-terra hover:bg-terra/5"
                        role="menuitem"
                      >
                        <LogOut size={15} /> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-3 sm:flex">
              <Link to="/login" className="text-sm text-ink-soft/80 hover:text-ink">
                Sign in
              </Link>
              <Link to="/login" className="btn-primary px-4 py-2 text-sm">
                Create event
              </Link>
            </div>
          )}

          {/* Hamburger — always available on small/medium; also usable on large as backup */}
          <button
            type="button"
            className="rounded-full p-2 text-ink ring-1 ring-ink/10 transition hover:bg-cream lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-ink/5 bg-cream lg:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {publicLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-ink hover:bg-parchment"
                >
                  {l.label}
                </Link>
              ))}
              {user ? (
                <>
                  <div className="my-2 border-t border-ink/8" />
                  <p className="px-3 text-[11px] uppercase tracking-wider text-ink/40">Creator</p>
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-ink hover:bg-parchment"
                  >
                    <LayoutDashboard size={16} /> Studio dashboard
                  </Link>
                  <Link
                    to="/events/new"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-ink hover:bg-parchment"
                  >
                    <Plus size={16} /> New event
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-ink hover:bg-parchment"
                  >
                    <Settings size={16} /> Account settings
                  </Link>
                  <Link
                    to="/guide"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-ink hover:bg-parchment"
                  >
                    <BookOpen size={16} /> Creator guide
                  </Link>
                  <Link
                    to="/faq"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-ink hover:bg-parchment"
                  >
                    <HelpCircle size={16} /> FAQ
                  </Link>
                  <p className="mt-2 truncate px-3 text-xs text-ink/45">{user.email}</p>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-terra hover:bg-terra/5"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <div className="my-2 border-t border-ink/8" />
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-primary mt-1 text-center">
                    Sign in / Create event
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
