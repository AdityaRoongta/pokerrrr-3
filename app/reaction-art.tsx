import { type ComponentType, type CSSProperties } from 'react';
import { type PokerSound } from '../lib/poker-audio';
const svgProps = { viewBox: '0 0 100 100', fill: 'none', 'aria-hidden': true as const };
function Glass() {
  return <g stroke="#f8e8c6" strokeWidth="2.7" strokeLinecap="round"><path d="M30 12H58L63 36Q64 55 44 56Q24 55 25 36Z" fill="#e7e6e51c" /><path d="M27 32H61L60 42Q55 54 44 53Q31 54 27 42Z" fill="#9f244e" stroke="none" /><path d="M44 57V81M31 83H57M33 18L30 29" /></g>;
}
export function CheersArt() {
  return <svg {...svgProps}><g className="glass-left" transform="translate(-8 5) rotate(15 44 55)"><Glass /></g><g className="glass-right" transform="translate(30 -1) rotate(-15 44 55)"><Glass /></g><path className="clink-spark" d="M48 9V2M58 11L65 4M64 22L75 21" stroke="#ffe39d" strokeWidth="3" strokeLinecap="round" /></svg>;
}
export function MoneyArt() {
  return <svg {...svgProps}><g transform="rotate(-12 50 50)"><rect x="9" y="24" width="81" height="49" rx="5" fill="#5d9d66" stroke="#d0e2a3" strokeWidth="3" /><rect x="16" y="31" width="67" height="35" rx="3" stroke="#c9dda1" strokeWidth="1.5" /><ellipse cx="49" cy="49" rx="14" ry="17" fill="#d8e5ac" /><path d="M53 39H46Q39 39 43 46L53 51Q59 59 47 59H42M49 35V63" stroke="#426849" strokeWidth="3" strokeLinecap="round" /><path d="M22 41V55M76 41V55" stroke="#c9dda1" strokeWidth="3" /></g></svg>;
}
export function TomatoArt() {
  return <svg {...svgProps}><path d="M20 38Q29 22 48 31Q67 20 80 37Q94 56 78 77Q53 97 27 78Q9 62 20 38Z" fill="#e34132" stroke="#842d28" strokeWidth="3" /><path d="M49 31L32 20L43 20L51 9L55 22L71 24L57 32L65 43L51 37L40 45L43 33Z" fill="#54874a" /><path d="M28 49Q24 59 32 68" stroke="#ff9880" strokeWidth="5" strokeLinecap="round" /></svg>;
}
export function CrownArt() {
  return <svg {...svgProps}><path d="M17 73L9 28L32 43L50 13L68 43L91 28L83 73Z" fill="#e5b851" stroke="#8d652e" strokeWidth="3" strokeLinejoin="round" /><path d="M20 79H80M22 65H78" stroke="#ffe5a0" strokeWidth="6" strokeLinecap="round" /><path d="M50 37L57 48L50 59L43 48Z" fill="#9d3850" />{[9,50,91].map((x,i) => <circle key={x} cx={x} cy={i === 1 ? 12 : 27} r="4" fill="#fff0b4" />)}</svg>;
}
export function LaughArt() {
  return <svg {...svgProps}><circle cx="50" cy="49" r="35" fill="#efbd47" stroke="#b8842b" strokeWidth="2" /><path d="M26 39Q34 29 42 39M58 39Q66 29 74 39" stroke="#54382c" strokeWidth="5" strokeLinecap="round" /><path d="M29 50Q50 62 72 50Q68 80 50 80Q32 80 29 50Z" fill="#613427" /><path d="M33 53Q50 61 68 53L65 61H37Z" fill="#fff2cf" /><path d="M39 74Q50 64 61 74" fill="#e87d77" /><path className="laugh-tear" d="M17 44Q2 57 11 65Q22 70 24 58Z" fill="#75c6e3" /><path className="laugh-tear" d="M83 44Q98 57 89 65Q78 70 76 58Z" fill="#75c6e3" /></svg>;
}
export function DuckArt() {
  return <svg {...svgProps}><path d="M19 54Q36 44 50 57L64 39Q77 35 84 49L85 69Q73 89 43 85Q14 85 11 65L5 52L20 59Z" fill="#e8d5a2" stroke="#9b8259" strokeWidth="2.5" /><circle cx="69" cy="34" r="19" fill="#43846c" /><path d="M80 33L97 38L83 44Z" fill="#e6a648" /><circle cx="75" cy="28" r="3" fill="#152c28" /><path d="M54 47L80 49" stroke="#f8eacf" strokeWidth="4" /><path d="M26 61Q39 57 49 69Q40 80 27 71" fill="#9d8b61" /><path d="M43 87L35 95M60 87L69 95" stroke="#dea14e" strokeWidth="4" strokeLinecap="round" /></svg>;
}
export function PunchArt() {
  return <svg {...svgProps}><path d="M18 71L24 48Q15 35 24 21Q33 8 58 12Q82 13 83 31L86 53Q84 68 66 73L58 88L18 82Z" fill="#ad3836" stroke="#552725" strokeWidth="3" /><path d="M23 74L62 79L58 90L17 85Z" fill="#eee0c3" /><path d="M25 48L38 43Q47 39 47 51L46 62M59 20Q73 20 74 32" stroke="#e48471" strokeWidth="5" strokeLinecap="round" /></svg>;
}
function Sparkles() { return <div className="reaction-sparkles">{Array.from({length: 5}, (_, i) => <i key={i} style={{ '--particle': i } as CSSProperties}>✦</i>)}</div>; }
function CheersAnimation() { return <div className="reaction-at-target cheers-effect"><CheersArt /><Sparkles /></div>; }
function MoneyAnimation() { return <div className="reaction-at-target money-effect">{Array.from({length: 7}, (_, i) => <div className="flying-note" key={i} style={{ '--note': i, '--spread-x': `${(i - 3) * 27}px`, '--spread-y': `${-85 - Math.abs(i - 3) * 12}px` } as CSSProperties}><MoneyArt /></div>)}</div>; }
function TomatoAnimation() { return <><div className="social-flight tomato-flight"><TomatoArt /></div><div className="reaction-at-target tomato-splat"><i />{Array.from({length: 7}, (_, i) => <b key={i} style={{ '--drop-angle': `${i * 51}deg` } as CSSProperties} />)}</div></>; }
function CrownAnimation() { return <><div className="social-flight crown-flight"><CrownArt /></div><div className="reaction-at-target crown-aura"><Sparkles /></div></>; }
function LaughAnimation() { return <div className="social-flight laugh-flight"><div className="laugh-bounce"><LaughArt /></div></div>; }
function DuckAnimation() { return <div className="social-flight duck-flight"><div className="duck-waddle"><DuckArt /></div><span className="duck-ripple" /></div>; }
function PunchAnimation() { return <><div className="social-flight punch-flight"><PunchArt /></div><div className="reaction-at-target punch-contact"><i /><i /><i /></div></>; }
export const reactionRenderers: Record<string, { Icon: ComponentType; Animation: ComponentType; sound: PokerSound }> = {
  cheers: { Icon: CheersArt, Animation: CheersAnimation, sound: 'cheers' },
  money: { Icon: MoneyArt, Animation: MoneyAnimation, sound: 'money' },
  tomato: { Icon: TomatoArt, Animation: TomatoAnimation, sound: 'tomato' },
  crown: { Icon: CrownArt, Animation: CrownAnimation, sound: 'crown' },
  laugh: { Icon: LaughArt, Animation: LaughAnimation, sound: 'laugh' },
  duck: { Icon: DuckArt, Animation: DuckAnimation, sound: 'duck' },
  punch: { Icon: PunchArt, Animation: PunchAnimation, sound: 'punch' }
};
