import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FairSlot] UI crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center bg-parchment px-5">
          <div className="max-w-md rounded-[2rem] bg-cream p-8 text-center ring-1 ring-ink/8">
            <p className="text-xs uppercase tracking-[0.2em] text-sage">Something went wrong</p>
            <h1 className="mt-2 font-display text-3xl">The page hit a snag</h1>
            <p className="mt-3 text-sm text-ink-soft/70">
              Try refreshing. If it keeps happening, sign out and back in.
            </p>
            <p className="mt-3 break-words rounded-xl bg-terra/10 px-3 py-2 text-left text-xs text-terra">
              {this.state.error.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn-primary px-5 py-2 text-sm"
                onClick={() => window.location.assign('/')}
              >
                Go home
              </button>
              <button
                type="button"
                className="rounded-full bg-parchment px-5 py-2 text-sm ring-1 ring-ink/10"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
