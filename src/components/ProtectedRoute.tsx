import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  if (!configured) {
    return (
      <div className="min-h-screen grid place-items-center bg-parchment px-5 text-center">
        <div>
          <h1 className="font-display text-3xl">Supabase not configured</h1>
          <p className="mt-2 text-sm text-ink-soft/70">Set VITE_SUPABASE_* build variables and redeploy.</p>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-parchment">
        <div className="flex flex-col items-center gap-3">
          <span className="h-10 w-10 rounded-full border-2 border-moss/20 border-t-moss animate-spin" />
          <p className="text-sm text-ink-soft/70">Opening your studio…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
