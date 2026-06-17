import { useEffect, useRef } from "react";
import { MediaSlot } from "./MediaSlot";

const DEMO_VIDEO = "/videos/demo.mp4";

export function HeroMockup() {
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
      video.currentTime = 0;
      video.play().catch(() => {});
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
    <div className="v-media-slot v-media-slot-hero v-dashboard-slot">
      <video
        ref={videoRef}
        className="v-media-slot-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Product demo"
      >
        <source src={DEMO_VIDEO} type="video/mp4" />
      </video>
    </div>
  );
}

const FEATURE_IMAGES = {
  detect: {
    src: "/images/feature-drone.jpg",
    alt: "Drone inspecting city infrastructure at night",
  },
  repair: {
    src: "/images/feature-capitol.jpg",
    alt: "Georgia State Capitol and Atlanta skyline",
  },
} as const;

export function FeatureMock({ variant }: { variant?: "detect" | "repair" | "security" }) {
  const image = variant ? FEATURE_IMAGES[variant as keyof typeof FEATURE_IMAGES] : undefined;

  if (image) {
    return (
      <div className="v-media-slot v-media-slot-sm v-dashboard-slot">
        <img alt={image.alt} className="v-media-slot-image" src={image.src} />
      </div>
    );
  }

  return <MediaSlot size="sm" className="v-dashboard-slot" />;
}
