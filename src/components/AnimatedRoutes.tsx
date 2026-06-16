import { ReactNode, useEffect } from "react";
import { Routes, useLocation } from "react-router-dom";

type AnimatedRoutesProps = {
  children: ReactNode;
};

export function AnimatedRoutes({ children }: AnimatedRoutesProps) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="v-page-fade">
      <Routes location={location}>{children}</Routes>
    </div>
  );
}
