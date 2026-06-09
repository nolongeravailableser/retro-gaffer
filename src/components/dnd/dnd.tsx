import type { ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

/**
 * Thin wrappers over dnd-kit. We intentionally spread only drag *listeners*
 * (not the a11y attributes) and skip the keyboard sensor: pointer drag is the
 * enhancement, while click-to-assign remains the full keyboard/a11y path.
 */

export function Draggable({
  id,
  playerId,
  children,
  className,
}: {
  id: string;
  playerId: string;
  children: ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data: { playerId } });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      // role/tabindex only; omit the grab cursor when not draggable
      aria-roledescription={attributes['aria-roledescription']}
      className={`${className ?? ''} touch-none ${isDragging ? 'opacity-60' : ''}`}
    >
      {children}
    </div>
  );
}

export function Droppable({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-over={isOver} className={className}>
      {children}
    </div>
  );
}
