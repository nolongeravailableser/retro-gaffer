import { useGameStore, getPlayer, isSlotEligible } from '@/store/useGameStore';
import { getFormation } from '@/lib/formations';
import { Draggable, Droppable } from '@/components/dnd/dnd';
import Slot from './Slot';

interface PitchProps {
  /** playerId → chemistry multiplier (1 = none). */
  multipliers: Map<string, number>;
}

/** The tactical board. Rows + slot roles come from the active formation. */
export default function Pitch({ multipliers }: PitchProps) {
  const xi = useGameStore((s) => s.xi);
  const formationId = useGameStore((s) => s.formation);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const slotClicked = useGameStore((s) => s.slotClicked);
  const removeFromSlot = useGameStore((s) => s.removeFromSlot);

  const formation = getFormation(formationId);

  return (
    <div className="rounded-xl border border-crt-dim bg-gradient-to-b from-pitch-700/40 to-pitch-900/60 p-4">
      <div className="relative flex flex-col gap-4 rounded-lg border border-white/10 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_40px,transparent_40px,transparent_80px)] px-2 py-5">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        {formation.rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-3 sm:gap-5">
            {row.map((slotIndex) => {
              const playerId = xi[slotIndex];
              const player = getPlayer(playerId);
              const hasSelection = selectedPlayerId !== null;
              const eligible =
                hasSelection &&
                isSlotEligible(selectedPlayerId, slotIndex, formationId);
              const slot = (
                <Slot
                  role={formation.slots[slotIndex]}
                  player={player}
                  selected={!!player && player.id === selectedPlayerId}
                  multiplier={player ? multipliers.get(player.id) ?? 1 : 1}
                  eligibleTarget={eligible}
                  blockedTarget={hasSelection && !eligible}
                  onClick={() => slotClicked(slotIndex)}
                  onRemove={() => removeFromSlot(slotIndex)}
                  slotIndex={slotIndex}
                />
              );
              return (
                <Droppable
                  key={slotIndex}
                  id={`slot:${slotIndex}`}
                  className="rounded-lg transition data-[over=true]:ring-2 data-[over=true]:ring-crt-green/70"
                >
                  {player ? (
                    <Draggable id={`slot-player:${player.id}`} playerId={player.id}>
                      {slot}
                    </Draggable>
                  ) : (
                    slot
                  )}
                </Droppable>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
