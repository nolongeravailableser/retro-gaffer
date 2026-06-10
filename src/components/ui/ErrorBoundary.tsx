import { Component, type ReactNode } from 'react';
import { encodeSave } from '@/lib/savecode';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  copied: boolean;
}

/**
 * Last line of defence: a crash anywhere in the tree becomes a recovery screen
 * instead of a blank page. Reads the save straight from localStorage (NOT via
 * the store — the store may be what crashed) so the player can always rescue
 * their run as a code before reloading.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface in the console for bug reports; no telemetry in this game.
    console.error('Retro Gaffer crashed:', error);
  }

  private copySave = async () => {
    try {
      // Encode a proper GAFFER-SAVE code so the player can restore it through
      // the normal Club-tab import after reloading. encodeSave is a pure lib
      // function — safe even when the store/UI is what crashed. Fall back to
      // the raw blob if the persisted JSON is too mangled to encode.
      const raw = localStorage.getItem('gaffer-run') ?? '';
      let payload = raw;
      try {
        const blob = JSON.parse(raw) as { state?: Record<string, unknown> };
        if (blob?.state) payload = encodeSave(blob.state);
      } catch {
        /* keep raw */
      }
      await navigator.clipboard.writeText(payload);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 1600);
    } catch {
      /* clipboard blocked — nothing else we can do here */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-pitch-950 px-6 text-center">
        <h1 className="font-display text-2xl text-rose-300">FULL-TIME WHISTLE — SOMETHING BROKE</h1>
        <p className="max-w-md text-sm text-chrome-muted">
          The game hit an unexpected error. Your run autosaves, so reloading almost
          always picks up exactly where you were.
        </p>
        <pre className="max-w-md overflow-x-auto rounded-lg border border-white/10 bg-pitch-900/70 px-3 py-2 text-left font-ticker text-xs text-chrome-muted">
          {this.state.error.message}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
          >
            Reload the game
          </button>
          <button
            type="button"
            onClick={this.copySave}
            className="rounded-lg border border-white/15 px-4 py-2 font-display text-sm text-chrome-muted hover:bg-white/5 hover:text-chrome"
          >
            {this.state.copied ? 'Copied!' : 'Copy save code'}
          </button>
        </div>
        <p className="max-w-md text-xs text-chrome-muted">
          The copied code restores via Club → Move Your Run → paste &amp; Load.
        </p>
      </div>
    );
  }
}
