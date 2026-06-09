import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDriveDownload, Copy, Check, Upload, AlertTriangle, Smartphone } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';

/** Move a run between devices via a text code (no backend / no login). */
export default function SavePanel() {
  const exportSave = useGameStore((s) => s.exportSave);
  const importSave = useGameStore((s) => s.importSave);

  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — field is selectable */
    }
  };

  const load = () => {
    const err = importSave(input);
    if (err) {
      setError(err);
      setLoaded(false);
    } else {
      setError(null);
      setLoaded(true);
      setInput('');
      setTimeout(() => setLoaded(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <h2 className="mb-1 flex items-center gap-2 font-display text-xl">
        <Smartphone size={18} /> Move Your Run
      </h2>
      <p className="mb-3 text-[11px] text-chrome-muted">
        Your run autosaves in this browser. To continue on another device, copy a
        save code and paste it there.
      </p>

      {/* Export */}
      <div className="mb-3">
        {!code ? (
          <button
            type="button"
            onClick={() => {
              setCode(exportSave());
              setCopied(false);
            }}
            data-testid="generate-save"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-crt-green/40 bg-crt-green/10 py-2 font-display text-sm text-crt-green hover:bg-crt-green/20"
          >
            <HardDriveDownload size={14} /> Generate save code
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              readOnly
              value={code}
              data-testid="save-code"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-pitch-950 px-2 py-1.5 font-ticker text-xs text-crt-green"
            />
            <button
              type="button"
              onClick={copy}
              aria-label="Copy save code"
              className="flex items-center gap-1 rounded-md border border-white/15 px-2.5 text-xs hover:bg-white/5"
            >
              {copied ? <Check size={14} className="text-crt-green" /> : <Copy size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* Import */}
      <div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste GAFFER-SAVE-… code"
            data-testid="save-input"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-pitch-950 px-2 py-1.5 font-ticker text-xs placeholder:text-chrome-muted/60"
          />
          <button
            type="button"
            onClick={load}
            disabled={!input.trim()}
            data-testid="load-save"
            className="flex items-center gap-1 rounded-md border border-white/15 px-3 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={14} /> Load
          </button>
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="err"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="alert"
              data-testid="save-error"
              className="mt-2 flex items-center gap-1.5 text-sm text-rose-300"
            >
              <AlertTriangle size={14} /> {error}
            </motion.p>
          )}
          {loaded && (
            <motion.p
              key="ok"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-center gap-1.5 text-sm text-crt-green"
            >
              <Check size={14} /> Save loaded — picking up where you left off.
            </motion.p>
          )}
        </AnimatePresence>
        <p className="mt-2 text-[10px] text-chrome-muted">
          Loading a save replaces your current run.
        </p>
      </div>
    </div>
  );
}
