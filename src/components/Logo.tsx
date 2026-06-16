import type { MouseEventHandler } from "react";
import { Link } from "react-router-dom";

interface LogoProps {
  to?: string;
  light?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

const LOGO_SRC = "/verdant-logo.png";

export function Logo({ to = "/", light = false, onClick }: LogoProps) {
  return (
    <Link className={`vp-logo ${light ? "vp-logo-light" : ""}`} to={to} onClick={onClick}>
      <img className="vp-logo-mark" src={LOGO_SRC} alt="" width={34} height={28} />
      <span>Verdant</span>
    </Link>
  );
}
