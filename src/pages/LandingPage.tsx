import { Suspense, lazy, useEffect, useRef, memo, useState } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingMenu } from "./landing/LandingMenu";
import { useImageColor } from "@/hooks/useImageColor";
import { getLandingViewportProfile, getLandingViewportStyle } from "./landing/viewport";
import {
  readStartupPerformanceBudget,
  scheduleBackgroundTask,
  useDeferredMount,
  useHoverCapablePointer,
  useLowEndDevice,
  usePrefersReducedMotion,
  useStrongDesktopEffects,
} from "@/lib/performanceProfile";
import { playLandingTransition } from "./landing/intro";

interface ServiceCardProps {
  id: string;
  title: string;
  description: string;
  imgSrc: string;
  alt: string;
  overrideColor?: string;
  isReversed?: boolean;
}

let heroModelModulePromise: Promise<{ default: typeof import("./landing/components/HeroModel").HeroModel }> | null = null;

function preloadHeroModelModule() {
  if (!heroModelModulePromise) {
    heroModelModulePromise = import("./landing/components/HeroModel").then((module) => ({
      default: module.HeroModel,
    }));
  }

  return heroModelModulePromise;
}

const DeferredPreloadedHeroModel = lazy(preloadHeroModelModule);

const DeferredLibrarySync = lazy(async () => {
  const module = await import("./landing/components/LibrarySync");
  return { default: module.LibrarySync };
});

const DeferredExperienceManifesto = lazy(async () => {
  const module = await import("./landing/components/ExperienceManifesto");
  return { default: module.ExperienceManifesto };
});

function StaticHeroFallback() {
  return (
    <div className="hero-static-shell" aria-hidden="true">
      <div className="hero-static-grid" />
      <div className="hero-static-glow" />
      <div className="hero-static-visual" />
      <div className="hero-static-badge">
        <BrandLogo showLabel withInteractiveKnob className="scale-110" textClassName="text-2xl" />
      </div>
    </div>
  );
}

const ServiceCard = memo(({ id, title, description, imgSrc, alt, overrideColor, isReversed }: ServiceCardProps) => {
  const extractedColor = useImageColor(imgSrc);
  const cardColor = overrideColor || extractedColor;
  
  return (
    <div className={`service-card ${isReversed ? 'is-reversed' : ''}`} id={id}>
      <div 
        className="service-card-inner" 
        style={{ '--card-color': cardColor } as React.CSSProperties}
      >
        <div className="service-card-content">
          <h1>{title}</h1>
          <p className="ss">{description}</p>
        </div>
        <div className="service-card-img">
          <img src={imgSrc} alt={alt} loading="lazy" decoding="async" width="800" height="800" sizes="(max-width: 1000px) 100vw, 50vw" />
        </div>
      </div>
    </div>
  );
});

// Import original portfolio styles from the landing subdirectory
import "./landing/css/transition.css";
import "./landing/css/globals.css";
import "./landing/css/menu.css";
import "./landing/css/home.css";
import "./landing/css/footer.css";

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactiveMotionStartedRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasHoverCapablePointer = useHoverCapablePointer();
  const lowEndDevice = useLowEndDevice();
  const strongDesktopEffects = useStrongDesktopEffects();
  const startupBudget = readStartupPerformanceBudget();
  const secondaryVisualsReady = useDeferredMount(700);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 1600 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const viewportProfile = getLandingViewportProfile(viewportSize.width, viewportSize.height);
  const viewportStyle = getLandingViewportStyle(viewportSize.width, viewportSize.height);
  const allowPremiumLandingMotion =
    !prefersReducedMotion &&
    !lowEndDevice &&
    strongDesktopEffects &&
    hasHoverCapablePointer &&
    !startupBudget.constrainedNetwork;
  const shouldUseStaticHero = !allowPremiumLandingMotion || viewportProfile.isTabletOrSmaller;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = 0;
    const handleResize = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || shouldUseStaticHero) {
      return;
    }

    void preloadHeroModelModule();
  }, [shouldUseStaticHero]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const stopIntro = playLandingTransition(container, { lowEndDevice, prefersReducedMotion });
    const shouldLoadInteractiveDesktopMotion =
      allowPremiumLandingMotion &&
      viewportProfile.viewportKind === "desktop" &&
      !viewportProfile.isShort;

    if (!shouldLoadInteractiveDesktopMotion) {
      interactiveMotionStartedRef.current = false;
      return stopIntro;
    }

    let active = true;
    let cleanup = () => undefined;
    let cancelScheduledTask = () => undefined;
    let fallbackTimer = 0;

    const startInteractiveMotion = () => {
      if (!active || interactiveMotionStartedRef.current || !containerRef.current) return;
      interactiveMotionStartedRef.current = true;
      removeActivationListeners();
      cancelScheduledTask = scheduleBackgroundTask(() => {
        void import("./landing/useLandingAnimations").then(({ startLandingAnimations }) => {
          if (!active || !containerRef.current) return;
          cleanup = startLandingAnimations(containerRef.current, {
            lowEndDevice,
            prefersReducedMotion,
          });
        });
      }, 350);
    };

    const handleActivationEvent = () => {
      startInteractiveMotion();
    };

    const removeActivationListeners = () => {
      window.removeEventListener("scroll", handleActivationEvent);
      window.removeEventListener("wheel", handleActivationEvent);
      window.removeEventListener("pointerdown", handleActivationEvent);
      window.removeEventListener("keydown", handleActivationEvent);
    };

    window.addEventListener("scroll", handleActivationEvent, { passive: true });
    window.addEventListener("wheel", handleActivationEvent, { passive: true });
    window.addEventListener("pointerdown", handleActivationEvent, { passive: true });
    window.addEventListener("keydown", handleActivationEvent);
    fallbackTimer = window.setTimeout(startInteractiveMotion, 1800);

    return () => {
      active = false;
      interactiveMotionStartedRef.current = false;
      window.clearTimeout(fallbackTimer);
      removeActivationListeners();
      cancelScheduledTask();
      cleanup();
      stopIntro();
    };
  }, [allowPremiumLandingMotion, lowEndDevice, prefersReducedMotion, viewportProfile.isShort, viewportProfile.viewportKind]);

  return (
    <div
      className="page home-page landing-wrapper"
      ref={containerRef}
      style={viewportStyle}
      data-landing-viewport={viewportProfile.viewportKind}
      data-landing-height={viewportProfile.heightKind}
    >
      <LandingMenu />
      {shouldUseStaticHero ? (
        <StaticHeroFallback />
      ) : (
        <Suspense fallback={<StaticHeroFallback />}>
          <DeferredPreloadedHeroModel />
        </Suspense>
      )}

      {/* Transition Overlay */}
      <div className="transition">
        <div className="transition-overlay overlay-1"></div>
        <div className="transition-overlay overlay-2"></div>
        <div className="transition-overlay overlay-3"></div>
        <div className="transition-overlay overlay-4"></div>
        <div className="transition-overlay overlay-5"></div>
        
        <div className="transition-logo-container">
          <BrandLogo showLabel withInteractiveKnob className="scale-150" textClassName="text-3xl" />
        </div>
      </div>

      {/* Hero Text Overlay */}
      <section className="hero-spacer">
        <h1 className="hero-hyper-text">EXPERIENCE</h1>
      </section>

      {/* Overhauled About Section */}
      <Suspense fallback={null}>
        {secondaryVisualsReady ? <DeferredExperienceManifesto /> : null}
      </Suspense>

      {/* Featured Work (Horizontal Scroll) */}
      <section className="featured-work">
        <div className="featured-images" aria-hidden="true" />
        <div className="featured-titles">
          <div className="featured-title-wrapper">
            <h1 className="featured-title">Trending Tracks</h1>
          </div>
          <div className="featured-title-wrapper">
            <h1 className="featured-title">Sub Urban - Cradles</h1>
          </div>
          <div className="featured-title-wrapper">
            <h1 className="featured-title">Imagine Dragons - Believer</h1>
          </div>
          <div className="featured-title-wrapper">
            <h1 className="featured-title">Bebe Rexha - I'm a Mess</h1>
          </div>
          <div className="featured-title-wrapper">
            <h1 className="featured-title">Billie Eilish - Happier Than Ever</h1>
          </div>
        </div>
        
        <div className="featured-work-footer">
          <p className="mn">Featured Tracks [ 10 ]</p>
          <p className="mn">///////////////////</p>
          <p className="mn"><Link to="/browse">Open Player</Link></p>
        </div>
      </section>

      {/* Interactive Library Sync Section */}
      <Suspense fallback={null}>
        {secondaryVisualsReady ? <DeferredLibrarySync /> : null}
      </Suspense>

      {/* Services / Skills Section */}
      <section className="services">
        <ServiceCard 
          id="service-card-1"
          title="Listening Stats"
          description="Dive deep into your habits with detailed insights on your counted plays, peak hours, and top artists."
          imgSrc="/images/promo/stats_new.webp"
          alt="Listening Stats"
          overrideColor="hsla(220, 100%, 50%, 0.85)"
        />
        <ServiceCard 
          id="service-card-2"
          title="Now Playing"
          description="Experience music through a modern fairytale with beautifully rendered lyrics and immersive high-fidelity artwork."
          imgSrc="/images/promo/lyrics.webp"
          alt="Lyrics"
          isReversed={true}
        />
        <ServiceCard 
          id="service-card-3"
          title="Artist Discovery"
          description="Explore a curated universe of global icons. From Ariana Grande to Sofía Reyes, find your next obsession."
          imgSrc="/images/promo/artists.webp"
          alt="Artists"
          overrideColor="hsla(75, 40%, 30%, 0.85)"
        />
        <ServiceCard 
          id="service-card-4"
          title="Latest Drops"
          description="Stay ahead of the curve with fresh tracks and albums from the artists you love, delivered in stunning detail."
          imgSrc="/images/promo/releases.webp"
          alt="Releases"
          overrideColor="hsla(30, 100%, 50%, 0.85)"
          isReversed={true}
        />
      </section>


      {/* Footer */}
      <footer>
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-col">
              <p className="footer-label">KNOBB</p>
              <p>THE NEW DIMENSION OF LISTENING</p>
            </div>
            <div className="footer-col">
              <p className="footer-label">EXPERIENCE</p>
              <p><Link to="/browse">BROWSE</Link></p>
              <p><Link to="/browse">LIBRARY</Link></p>
              <p><Link to="/settings">SETTINGS</Link></p>
            </div>
            <div className="footer-col">
              <p className="footer-label">SOCIAL</p>
              <p><a href="https://github.com/MunasibApurbo/knobb-desktop" target="_blank" rel="noopener noreferrer">GITHUB</a></p>
            </div>
            <div className="footer-col">
              <p className="footer-label">LEGAL</p>
              <p>KNOBB &copy; 2026</p>
              <p>SUPPORT@KNOBB.IO</p>
            </div>
          </div>

          <div className="footer-separator"></div>

          <div className="footer-header">
            <h1>KNOBB</h1>
          </div>
        </div>
      </footer>
    </div>
  );
}
