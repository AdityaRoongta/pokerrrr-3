'use client';
import { useLayoutEffect, useRef, useState } from 'react';

// Measure the actual seat, including the compact keyboard layout. Keep angles
// unwrapped so moving across 0° never spins the beam almost a full revolution.
export function TurnBeam({ target }: { target: string | null }) {
  const anchor = useRef<SVGSVGElement>(null);
  const angle = useRef<number | null>(null);
  const [beam, setBeam] = useState({ x: 0, y: 0, angle: 0, length: 0, halfWidth: 30 });
  useLayoutEffect(() => {
    const stage = anchor.current?.parentElement;
    if (!stage || !target) { angle.current = null; return; }
    const seat = stage.querySelector<HTMLElement>('.seat.acting .seat-info');
    if (!seat) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect(), end = seat.getBoundingClientRect();
      const x = bounds.width / 2, y = bounds.height / 2;
      const dx = end.left + end.width / 2 - bounds.left - x;
      const dy = end.top + end.height / 2 - bounds.top - y;
      let next = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle.current !== null) next = angle.current + ((next - angle.current + 540) % 360 + 360) % 360 - 180;
      angle.current = next;
      setBeam({ x, y, angle: next, length: Math.hypot(dx, dy), halfWidth: end.width * .65 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage); observer.observe(seat);
    const layout = new MutationObserver(measure);
    layout.observe(stage.closest('.app')!, { attributes: true, attributeFilter: ['class', 'data-chat-compact'] });
    return () => { observer.disconnect(); layout.disconnect(); };
  }, [target]);
  return <svg ref={anchor} className={`turn-beam ${target ? 'is-active' : ''}`} aria-hidden="true">
    <defs><linearGradient id="turn-light"><stop offset="0" stopColor="#ffe6a4" stopOpacity=".03" /><stop offset="1" stopColor="#ffe6a4" stopOpacity=".32" /></linearGradient></defs>
    <g transform={`translate(${beam.x} ${beam.y})`}><g className="turn-beam-direction" style={{ transform: `rotate(${beam.angle}deg)` }}>
      <path d={`M 0 0 L ${beam.length} ${-beam.halfWidth} Q ${beam.length + 12} 0 ${beam.length} ${beam.halfWidth} Z`} fill="url(#turn-light)" />
    </g></g>
  </svg>;
}
