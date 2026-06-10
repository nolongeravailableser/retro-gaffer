import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Copy,
  Check,
  Swords,
  AlertTriangle,
  Download,
  Link as LinkIcon,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import {
  exportTeam,
  importTeam,
  challengeUrl,
  type OpponentTeam,
} from '@/lib/codec';

interface PvpPanelProps {
  /** Whether the player has fielded anyone (gates export + play). */
  canPlay: boolean;
  onPlayImported: (opponent: OpponentTeam) => void;
}

/** Async PvP: share your XI as a code, import an opponent's, and play it. */
export default function PvpPanel({ canPlay, onPlayImported }: PvpPanelProps) {
  const xi = useGameStore((s) => s.xi);
  const formation = useGameStore((s) => s.formation);
  const clubName = useGameStore((s) => s.clubName);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [input, setInput] = useState('');
  const [opponent, setOpponent] = useState<OpponentTeam | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setMyCode(exportTeam(xi, clubName ?? 'Your XI', formation));
    setCopied(null);
  };

  const copyText = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard blocked — the code is selectable in the field as a fallback.
    }
  };

  const load = () => {
    const result = importTeam(input);
    if (result.ok) {
      setOpponent(result.team);
      setError(null);
    } else {
      setOpponent(null);
      setError(result.error);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl">
        <Swords size={18} /> Async PvP
      </h2>

      {/* Export */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs uppercase tracking-wide text-chrome-muted">
          Share your XI
        </p>
        {!myCode ? (
          <button
            type="button"
            onClick={generate}
            disabled={!canPlay}
            data-testid="generate-code"
            className={[
              'flex w-full items-center justify-center gap-2 rounded-md py-2 font-display text-sm transition',
              canPlay
                ? 'border border-crt-amber/40 bg-crt-amber/10 text-crt-amber hover:bg-crt-amber/20'
                : 'cursor-not-allowed border border-white/10 bg-white/5 text-chrome-muted',
            ].join(' ')}
          >
            <Share2 size={14} /> Generate share code
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={myCode}
                data-testid="my-code"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-pitch-950 px-2 py-1.5 font-ticker text-sm text-crt-amber"
              />
              <button
                type="button"
                onClick={() => copyText(myCode, 'code')}
                aria-label="Copy code"
                className="flex items-center gap-1 rounded-md border border-white/15 px-2.5 text-xs hover:bg-white/5"
              >
                {copied === 'code' ? (
                  <Check size={14} className="text-crt-green" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyText(challengeUrl(myCode), 'link')}
              data-testid="copy-link"
              className="flex items-center justify-center gap-1.5 rounded-md border border-white/15 py-1.5 text-xs hover:bg-white/5"
            >
              {copied === 'link' ? (
                <Check size={13} className="text-crt-green" />
              ) : (
                <LinkIcon size={13} />
              )}
              Copy challenge link
            </button>
          </div>
        )}
      </div>

      {/* Import */}
      <div>
        <p className="mb-1.5 text-xs uppercase tracking-wide text-chrome-muted">
          Import an opponent
        </p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste GAFFER-1-… code"
            data-testid="opponent-code"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-pitch-950 px-2 py-1.5 font-ticker text-sm placeholder:text-chrome-muted/60"
          />
          <button
            type="button"
            onClick={load}
            disabled={!input.trim()}
            data-testid="load-opponent"
            className="flex items-center gap-1 rounded-md border border-white/15 px-3 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} /> Load
          </button>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              data-testid="import-error"
              className="mt-2 flex items-center gap-1.5 text-sm text-rose-300"
            >
              <AlertTriangle size={14} /> {error}
            </motion.p>
          )}
          {opponent && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-crt-green/30 bg-crt-green/10 px-3 py-2"
            >
              <span className="min-w-0 text-sm">
                <span className="font-display text-crt-green">{opponent.name}</span>{' '}
                <span className="text-chrome-muted">
                  ATK {opponent.attack} · DEF {opponent.defense}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onPlayImported(opponent)}
                disabled={!canPlay}
                data-testid="play-imported"
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-crt-green/40 bg-crt-green/15 px-3 py-1.5 font-display text-sm text-crt-green hover:bg-crt-green/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Swords size={14} /> Play
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
