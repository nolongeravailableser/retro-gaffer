import { Component, type ReactNode } from 'react';

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
      // Raw blob is enough to restore by pasting back into localStorage; the
      // in-game save-code flow is unavailable if the store itself is broken.
      const raw = localStorage.getItem('gaffer-run') ?? '';
      await navigator.clipboard.writeText(raw);
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
            {this.state.copied ? 'Copied!' : 'Copy save backup'}
          </button>
        </div>
      </div>
    );
  }
}
