'use client';
import { useLayoutEffect, useRef } from 'react';

// iOS standalone and browser chrome can disagree with CSS vh/dvh. Measure the
// actual visible height; update on rotation, browser toolbar and keyboard changes.
export function useAppViewport(inGame: boolean) {
  const app = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = app.current;
    if (!inGame || !element) return;
    let frame = 0;
    const measure = () => {
      const viewport = window.visualViewport;
      // Do not reflow the table while the user pinch-zooms it.
      if (viewport && Math.abs(viewport.scale - 1) > .01) return;
      const height = viewport?.height || window.innerHeight;
      element.toggleAttribute('data-chat-compact', height < 700 && element.classList.contains('composing-chat'));
      if (height > 0) element.style.setProperty('--app-viewport-height', `${Math.floor(height)}px`);
    };
    const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new MutationObserver(resize);
    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    measure();
    window.addEventListener('resize', resize);
    window.addEventListener('pageshow', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      observer.disconnect();
      element.removeAttribute('data-chat-compact');
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pageshow', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      element.style.removeProperty('--app-viewport-height');
    };
  }, [inGame]);
  return app;
}
