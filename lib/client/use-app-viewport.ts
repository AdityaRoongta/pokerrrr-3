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
      element.style.setProperty('--app-viewport-top', `${Math.max(0, viewport?.offsetTop || 0)}px`);
      element.style.setProperty('--app-viewport-left', `${Math.max(0, viewport?.offsetLeft || 0)}px`);
      if (height > 0) element.style.setProperty('--app-viewport-height', `${Math.floor(height)}px`);
    };
    const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    // iOS can leave a fixed element panned for one or two frames after the
    // keyboard closes. Clear the stale offset first, then re-measure after the
    // browser has finished restoring its visual viewport. This keeps the visual
    // table and its tap targets in the same place after leaving chat.
    const settleAfterKeyboard = () => {
      element.style.setProperty('--app-viewport-top', '0px');
      element.style.setProperty('--app-viewport-left', '0px');
      resize();
      window.setTimeout(resize, 120);
      window.setTimeout(resize, 360);
    };
    const afterTextInputBlur = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) settleAfterKeyboard();
    };
    const observer = new MutationObserver(resize);
    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    measure();
    window.addEventListener('resize', resize);
    window.addEventListener('pageshow', resize);
    window.addEventListener('orientationchange', settleAfterKeyboard);
    document.addEventListener('focusout', afterTextInputBlur);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pageshow', resize);
      window.removeEventListener('orientationchange', settleAfterKeyboard);
      document.removeEventListener('focusout', afterTextInputBlur);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      element.style.removeProperty('--app-viewport-height');
      element.style.removeProperty('--app-viewport-top');
      element.style.removeProperty('--app-viewport-left');
    };
  }, [inGame]);
  return app;
}
