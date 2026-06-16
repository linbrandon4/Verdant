import { useEffect, useRef } from "react";

const HERO_VIDEO = "/videos/hero.mp4";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.loop = true;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      video.pause();
      return;
    }

    const ensureLoop = () => {
      if (video.ended) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };

    video.addEventListener("ended", ensureLoop);
    video.play().catch(() => {});

    const onChange = () => {
      if (reducedMotion.matches) video.pause();
      else video.play().catch(() => {});
    };
    reducedMotion.addEventListener("change", onChange);
    return () => {
      video.removeEventListener("ended", ensureLoop);
      reducedMotion.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        className="v-hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>
    </>
  );
}
