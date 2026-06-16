import { MediaSlot } from "./MediaSlot";

export function HeroMockup() {
  return <MediaSlot size="hero" className="v-dashboard-slot" />;
}

export function FeatureMock(_props: { variant?: "detect" | "repair" | "security" }) {
  return <MediaSlot size="sm" className="v-dashboard-slot" />;
}
