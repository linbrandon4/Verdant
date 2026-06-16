import { useEffect, useRef } from "react";

const AUTH_VIDEO = "/videos/auth-atlanta.mp4";

export function AuthBrandVideo() {
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

    video.play().catch(() => {});

    const onChange = () => {
      if (reducedMotion.matches) video.pause();
      else video.play().catch(() => {});
    };
    reducedMotion.addEventListener("change", onChange);
    return () => reducedMotion.removeEventListener("change", onChange);
  }, []);

  return (
    <video
      ref={videoRef}
      className="v-auth-brand-video"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    >
      <source src={AUTH_VIDEO} type="video/mp4" />
    </video>
  );
}
