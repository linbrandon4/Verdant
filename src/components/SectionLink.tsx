import type { MouseEvent, ReactNode } from "react";
import { smoothScrollTo } from "../utils/smoothScroll";

export function SectionLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const id = href.startsWith("#") ? href.slice(1) : href;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!id) return;
    e.preventDefault();
    smoothScrollTo(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
