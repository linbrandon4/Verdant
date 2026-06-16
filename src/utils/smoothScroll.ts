const MIN_DURATION_MS = 750;
const MAX_DURATION_MS = 2000;
const MS_PER_PX = 0.9;
const SCROLL_OFFSET = 20;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function durationForDistance(distance: number) {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.abs(distance) * MS_PER_PX));
}

export function smoothScrollTo(id: string, duration?: number) {
  const target = document.getElementById(id);
  if (!target) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    target.scrollIntoView({ block: "start" });
    return;
  }

  const startY = window.scrollY;
  const endY = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
  const distance = endY - startY;
  const scrollDuration = duration ?? durationForDistance(distance);
  const startTime = performance.now();

  const tick = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / scrollDuration, 1);
    window.scrollTo(0, startY + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
