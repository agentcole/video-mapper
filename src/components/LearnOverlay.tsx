import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cable } from 'lucide-react';
import { useControls, type ControlSource } from '../control/mappings';
import { pickLearnTarget, stopLearning } from '../control/engine';
import { parseTarget, targetLabel } from '../control/targets';
import { keyLabel } from '../control/mappings';
import { noticeSurface } from './ui/theme';

// ---------------------------------------------------------------------------
// Learn mode: every control that can be mapped ([data-control]) gets a frame
// with what it is mapped to. Click one, then move a knob, press a pad or a
// key — that becomes its mapping. Delete removes the picked one's mappings.
// ---------------------------------------------------------------------------

interface Box {
  target: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const short = (s: ControlSource): string => {
  const ch = 'channel' in s && s.channel !== 0 ? `/${s.channel + 1}` : '';
  switch (s.kind) {
    case 'note': return `N${s.note}${ch}`;
    case 'cc': return `CC${s.cc}${ch}`;
    case 'pitchbend': return `PB${ch}`;
    case 'key': return keyLabel(s.code, s.shift, s.alt);
  }
};

/** Visible part of an element: clipped by its scroll container (the launcher grid). */
const visibleRect = (el: Element): DOMRect | null => {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const scope = el.closest('[data-control-scope]')?.getBoundingClientRect();
  const left = Math.max(r.left, scope?.left ?? -Infinity);
  const top = Math.max(r.top, scope?.top ?? -Infinity);
  const right = Math.min(r.right, scope?.right ?? Infinity);
  const bottom = Math.min(r.bottom, scope?.bottom ?? Infinity);
  return right - left > 4 && bottom - top > 4 ? new DOMRect(left, top, right - left, bottom - top) : null;
};

/** Is the element on top at this point (not covered by a panel)? The overlay itself doesn't count. */
const onTop = (el: Element, x: number, y: number): boolean => {
  for (const hit of document.elementsFromPoint(x, y)) {
    if (hit.closest('[data-learn-overlay]')) continue;
    return el.contains(hit);
  }
  return false;
};

const measure = (): Box[] => {
  const boxes: Box[] = [];
  document.querySelectorAll<HTMLElement>('[data-control]').forEach(el => {
    const target = el.dataset.control!;
    const r = visibleRect(el);
    if (!r || !onTop(el, r.left + r.width / 2, r.top + r.height / 2)) return;
    boxes.push({ target, left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
  });
  return boxes;
};

export const LearnOverlay: React.FC = () => {
  const learning = useControls(s => s.learning);
  const learnTarget = useControls(s => s.learnTarget);
  const learned = useControls(s => s.learned);
  const mappings = useControls(s => s.mappings);
  const [boxes, setBoxes] = useState<Box[]>([]);

  // Follow layout changes (scrolling, panels opening) every frame while learning
  useEffect(() => {
    if (!learning) return;
    let frame = 0;
    let last = '';
    const tick = () => {
      const next = measure();
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setBoxes(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [learning]);

  const labels = useMemo(() => {
    const byTarget = new Map<string, string[]>();
    for (const m of mappings) byTarget.set(m.target, [...(byTarget.get(m.target) ?? []), short(m.source)]);
    return byTarget;
  }, [mappings]);

  if (!learning) return null;
  const picked = learnTarget ? parseTarget(learnTarget) : null;
  const learnedTarget = learned ? parseTarget(learned.target) : null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[3400] pointer-events-none" data-learn-overlay>
        {boxes.map(box => {
          const mapped = labels.get(box.target);
          const selected = box.target === learnTarget;
          return (
            <button
              key={`${box.target}@${box.left},${box.top}`}
              type="button"
              className={`absolute pointer-events-auto rounded transition-colors ${
                selected
                  ? 'bg-cyan-400/30 ring-2 ring-cyan-300'
                  : mapped ? 'bg-cyan-500/10 ring-1 ring-cyan-400/70 hover:bg-cyan-500/25' : 'bg-white/5 outline-dashed outline-1 outline-white/40 hover:bg-white/15'
              }`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
              onClick={(e) => {
                e.stopPropagation();
                pickLearnTarget(selected ? null : box.target);
              }}
              title={targetLabel(parseTarget(box.target)!)}
            >
              {mapped && (
                <span className="absolute -top-1.5 left-0.5 px-1 rounded bg-cyan-500 text-black text-[9px] font-semibold leading-tight whitespace-nowrap">
                  {mapped.slice(0, 2).join(' ')}{mapped.length > 2 ? ` +${mapped.length - 2}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div data-learn-overlay className={`fixed top-4 left-1/2 -translate-x-1/2 z-[3500] ${noticeSurface} ring-1 ring-cyan-400/60 flex items-center gap-3 max-w-[90vw]`}>
        <Cable className="w-4 h-4 text-cyan-300 shrink-0" />
        <span className="min-w-0">
          {picked ? (
            <>Move a control or press a pad / key for <b className="text-cyan-200">{targetLabel(picked)}</b> · Delete removes its mappings</>
          ) : learned && learnedTarget ? (
            <>{learned.source ? <><b className="text-cyan-200">{learned.source}</b> → {targetLabel(learnedTarget)}</> : <>Mappings of {targetLabel(learnedTarget)} removed</>} · click the next control</>
          ) : (
            <>Learn: click a control, then move a knob, press a pad or a key</>
          )}
        </span>
        <button className="px-2 py-0.5 rounded bg-cyan-500 text-black font-semibold hover:bg-cyan-400 shrink-0" onClick={stopLearning} title="End learn mode (Esc)">
          Done
        </button>
      </div>
    </>,
    document.body,
  );
};
