type MediaSlotProps = {
  /** sm = feature sections, hero = main landing dashboard screenshot */
  size?: "sm" | "hero";
  className?: string;
};

/** Empty grid — drop in <img src="..." /> or screenshot when ready */
export function MediaSlot({ size = "sm", className = "" }: MediaSlotProps) {
  return (
    <div
      className={`v-media-slot v-media-slot-${size}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <div className="v-media-slot-grid" />
    </div>
  );
}
