import { useEffect, useState } from "react";

const agencies = [
  {
    name: "Atlanta Beltline",
    url: "https://beltline.org/",
    logo: "/logos/beltline.png",
  },
  {
    name: "Georgia Department of Natural Resources",
    url: "https://gadnr.org/",
    logo: "/logos/gadnr.png",
  },
  { name: "MARTA", url: "https://itsmarta.com/", logo: "/logos/marta.png" },
  { name: "GDOT", url: "https://www.dot.ga.gov/", logo: "/logos/gdot.png" },
  { name: "ATL311", url: "https://www.atl311.com/", logo: "/logos/atl311.png" },
  { name: "Atlanta DOT", url: "https://atldot.atlantaga.gov/", logo: "/logos/atlanta-dot.png" },
] as const;

function stripBlackBackground(src: string, threshold = 32): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxWidth = 360;
      const scale = image.width > maxWidth ? maxWidth / image.width : 1;
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r <= threshold && g <= threshold && b <= threshold) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function CarouselLogo({ src, alt }: { src: string; alt: string }) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    stripBlackBackground(src)
      .then((dataUrl) => {
        if (active) setProcessedSrc(dataUrl);
      })
      .catch(() => {
        if (active) setProcessedSrc(src);
      });

    return () => {
      active = false;
    };
  }, [src]);

  return (
    <img
      src={processedSrc ?? src}
      alt={alt}
      draggable={false}
      className={processedSrc ? "is-ready" : "is-loading"}
    />
  );
}

function LogoGroup({ groupId }: { groupId: number }) {
  return (
    <div className="v-trust-carousel-group" aria-hidden={groupId === 1 ? true : undefined}>
      {agencies.map((agency) => (
        <a
          key={`${groupId}-${agency.name}`}
          className="v-trust-carousel-logo"
          href={agency.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={agency.name}
          tabIndex={groupId === 1 ? -1 : undefined}
        >
          <CarouselLogo src={agency.logo} alt={agency.name} />
        </a>
      ))}
    </div>
  );
}

export function TrustCarousel() {
  return (
    <div className="v-trust-carousel" aria-label="Atlanta municipal agencies">
      <div className="v-trust-carousel-track">
        <LogoGroup groupId={0} />
        <LogoGroup groupId={1} />
      </div>
    </div>
  );
}
