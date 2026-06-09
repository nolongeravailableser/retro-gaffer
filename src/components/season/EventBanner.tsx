import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, X } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { RELICS } from '@/lib/relics';

/** "The Gaffer's Notebook" — owned relics + the current round's tabloid event. */
export default function EventBanner() {
  const event = useGameStore((s) => s.event);
  const relics = useGameStore((s) => s.relics);
  const claimRelic = useGameStore((s) => s.claimRelic);
  const dismissEvent = useGameStore((s) => s.dismissEvent);

  if (!event && relics.length === 0) return null;

  const formName =
    event?.kind === 'form' ? getPlayer(event.formPlayerId)?.name : undefined;

  return (
    <div className="rounded-xl border border-crt-amber/30 bg-pitch-900/70 p-3">
      {/* Owned relics */}
      {relics.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-chrome-muted">
            Relics
          </span>
          {relics.map((id) => {
            const r = RELICS[id];
            if (!r) return null;
            return (
              <span
                key={id}
                title={`${r.name} — ${r.blurb}`}
                className="flex items-center gap-1 rounded-full border border-crt-green/30 bg-crt-green/10 px-2 py-0.5 text-xs text-crt-green"
              >
                <span>{r.emoji}</span>
                {r.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Current event */}
      <AnimatePresence mode="wait">
        {event && (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-crt-amber/40 bg-crt-amber/10 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 font-display text-sm text-crt-amber">
                  <Newspaper size={14} /> {event.headline}
                </p>
                <p className="mt-0.5 text-xs text-chrome">
                  {formName ? event.blurb.replace('A starter', formName) : event.blurb}
                </p>
              </div>
              {event.kind !== 'relic' && (
                <button
                  type="button"
                  onClick={dismissEvent}
                  aria-label="Dismiss"
                  className="text-chrome-muted hover:text-chrome"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {event.kind === 'relic' && event.relicChoices && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {event.relicChoices.map((id) => {
                  const r = RELICS[id];
                  if (!r) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => claimRelic(id)}
                      data-testid={`claim-${id}`}
                      className="rounded-lg border border-crt-green/30 bg-pitch-800/70 p-2 text-left hover:border-crt-green/60 hover:bg-crt-green/10"
                    >
                      <p className="font-display text-sm text-crt-green">
                        {r.emoji} {r.name}
                      </p>
                      <p className="text-[11px] text-chrome-muted">{r.blurb}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
