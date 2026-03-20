import { memo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

export const LandingMenu = memo(() => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let frameId = 0;

    const handleScroll = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        linkRef.current?.style.setProperty("--knob-rotation", `${window.scrollY / 5}deg`);
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <nav className="landing-nav">
      <div className="logo">
        <Link 
          ref={linkRef}
          to="/" 
          className="logo-brand outline-none"
          style={{ "--knob-rotation": "0deg" } as React.CSSProperties}
        >
          <BrandLogo showLabel withInteractiveKnob />
        </Link>
      </div>
      <div className="nav-right">
        <Link to="/auth" className="nav-login-btn menu-sweep-hover">
          <span>Unlock Library</span>
        </Link>
      </div>
    </nav>
  );
});
