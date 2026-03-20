import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type LandingAnimationOptions = {
  lowEndDevice?: boolean;
  prefersReducedMotion?: boolean;
};

const FEATURED_CARD_CONTENT = [
  { eyebrow: "TRACK 01", title: "Sub Urban", subtitle: "Cradles" },
  { eyebrow: "TRACK 02", title: "Imagine Dragons", subtitle: "Believer" },
  { eyebrow: "TRACK 03", title: "Bebe Rexha", subtitle: "I'm a Mess" },
  { eyebrow: "TRACK 04", title: "Billie Eilish", subtitle: "Happier Than Ever" },
  { eyebrow: "TRACK 05", title: "The Weeknd", subtitle: "Die For You" },
  { eyebrow: "TRACK 06", title: "The Weeknd", subtitle: "Blinding Lights" },
  { eyebrow: "TRACK 07", title: "The Weeknd", subtitle: "Dancing In The Flames" },
  { eyebrow: "TRACK 08", title: "The Weeknd", subtitle: "Double Fantasy" },
  { eyebrow: "TRACK 09", title: "The Weeknd", subtitle: "Sao Paulo" },
  { eyebrow: "TRACK 10", title: "The Weeknd", subtitle: "Kiss Land" },
  { eyebrow: "TRACK 11", title: "The Weeknd", subtitle: "Sacrifice" },
  { eyebrow: "TRACK 12", title: "KNOBB", subtitle: "Open Player" },
] as const;

export function startLandingAnimations(
  container: HTMLDivElement,
  options: LandingAnimationOptions = {},
) {
  const prefersReducedMotion = options.prefersReducedMotion === true;
  const lowEndDevice = options.lowEndDevice === true;
  const shouldUseInteractiveDesktopMotion =
    !prefersReducedMotion && !lowEndDevice && window.innerWidth > 1000;

  gsap.registerPlugin(ScrollTrigger);
  let lenis: Lenis | null = null;
  let tickerCallback: ((time: number) => void) | null = null;

  const ctx = gsap.context(() => {
    if (shouldUseInteractiveDesktopMotion) {
      lenis = new Lenis({
        lerp: 0.11,
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        syncTouch: true,
        syncTouchLerp: 0.1,
        wheelMultiplier: 0.76,
        touchMultiplier: 1.06,
        infinite: false,
      });

      lenis.on("scroll", ScrollTrigger.update);
      tickerCallback = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tickerCallback);
    }

    gsap.config({ force3D: true, autoSleep: 60 });
    gsap.ticker.lagSmoothing(0);

    // 1.5 Hero Hyper Text Fade
    const heroHyperText = container.querySelector(".hero-hyper-text");
    if (heroHyperText && !prefersReducedMotion) {
      gsap.to(heroHyperText, {
        scrollTrigger: {
          trigger: ".hero-spacer",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
        opacity: 0,
        y: -100,
        ease: "none",
      });
    }

    // 4. Featured Work (Optimized Coordinate Generator)
    const initFeatured = () => {
      if (!shouldUseInteractiveDesktopMotion) return;
      const featuredTitles = container.querySelector(".featured-titles");
      const imagesContainer = container.querySelector(".featured-images");
      if (!featuredTitles) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const featuredImgCards: HTMLElement[] = [];

      if (imagesContainer) {
        const cardCount = 18;

        const generateZonePos = (index: number) => {
          const zone = index % 8;
          let x;
          let y;
          switch (zone) {
            case 0: x = Math.random() * (vw * 0.4); y = Math.random() * (vh * 0.4); break;
            case 1: x = vw + Math.random() * (vw * 0.4); y = Math.random() * (vh * 0.4); break;
            case 2: x = Math.random() * (vw * 0.4); y = vh + Math.random() * (vh * 0.4); break;
            case 3: x = vw + Math.random() * (vw * 0.4); y = vh + Math.random() * (vh * 0.4); break;
            case 4: x = Math.random() * (vw * 0.2); y = vh * 0.4 + Math.random() * (vh * 0.6); break;
            case 5: x = vw * 1.8 + Math.random() * (vw * 0.2); y = vh * 0.4 + Math.random() * (vh * 0.6); break;
            case 6: x = vw * 0.4 + Math.random() * (vw * 1.2); y = Math.random() * (vh * 0.2); break;
            case 7: x = vw * 0.4 + Math.random() * (vw * 1.2); y = vh * 1.8 + Math.random() * (vh * 0.2); break;
            default: x = Math.random() * (vw * 2); y = Math.random() * (vh * 2);
          }
          return { x, y };
        };

        imagesContainer.innerHTML = "";
        Array.from({ length: cardCount }, (_, index) => index).forEach((index) => {
          const pos = generateZonePos(index);
          const content = FEATURED_CARD_CONTENT[index % FEATURED_CARD_CONTENT.length];
          const card = document.createElement("div");
          card.className = "featured-img-card";
          card.innerHTML = `
            <div class="featured-card-eyebrow">${content.eyebrow}</div>
            <div class="featured-card-title">${content.title}</div>
            <div class="featured-card-subtitle">${content.subtitle}</div>
          `;
          card.dataset.x = pos.x.toString();
          card.dataset.y = pos.y.toString();
          gsap.set(card, { x: pos.x, y: pos.y, z: -1500, scale: 0, force3D: true, visibility: "hidden" });
          imagesContainer.appendChild(card);
        });

        featuredImgCards.push(
          ...Array.from(imagesContainer.querySelectorAll<HTMLElement>(".featured-img-card")),
        );
      }

      const moveDistance = vw * 4;

      ScrollTrigger.create({
        trigger: ".featured-work",
        start: "top top",
        end: `+=${vh * 5}px`,
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          const progress = self.progress;
          gsap.set(featuredTitles, { x: -moveDistance * progress, force3D: true });

          const flightDuration = 1 / 1.8;
          const startIndex = Math.max(0, Math.floor(((progress - flightDuration) / 0.9) * featuredImgCards.length) - 10);
          const endIndex = Math.min(featuredImgCards.length, Math.ceil((progress / 0.9) * featuredImgCards.length) + 10);

          featuredImgCards.forEach((card, i: number) => {
            if (i >= startIndex && i <= endIndex) {
              const staggerOffset = i * (0.9 / featuredImgCards.length);
              const individualProgress = (progress - staggerOffset) * 1.8;
              const safeProgress = Math.min(0.85, individualProgress);

              if (safeProgress > 0 && safeProgress <= 0.85) {
                const newZ = -2200 + 3800 * safeProgress;
                const scale = Math.min(1, safeProgress * 15);
                const opacity = safeProgress < 0.05
                  ? safeProgress * 20
                  : safeProgress > 0.7
                    ? Math.max(0, (0.85 - safeProgress) * 6.66)
                    : 1;

                card.style.transform = `translate3d(${card.dataset.x}px, ${card.dataset.y}px, ${newZ}px) scale(${scale})`;
                card.style.opacity = opacity.toFixed(3);

                if (card.style.visibility !== "visible") {
                  card.style.visibility = "visible";
                }
              } else if (card.style.visibility !== "hidden") {
                card.style.visibility = "hidden";
              }
            } else if (card.style.visibility !== "hidden") {
              card.style.visibility = "hidden";
            }
          });
        },
      });
    };
    initFeatured();

    // 5. Services Section (Pure Pinning Overlap)
    const initServices = () => {
      if (!shouldUseInteractiveDesktopMotion) return;
      const services = gsap.utils.toArray<HTMLElement>(".service-card");
      services.forEach((service, index: number) => {
        const inner = service.querySelector(".service-card-inner");

        ScrollTrigger.create({
          trigger: service,
          start: "top top",
          pin: true,
          pinSpacing: false,
          end: () => `+=${window.innerHeight}`,
          onUpdate: (self) => {
            const progress = self.progress;
            if (progress > 0.5) {
              const scaleProgress = (progress - 0.5) * 2;
              const opacity = 1 - (scaleProgress * 0.4);
              const blur = scaleProgress * 4;
              gsap.set(inner, { opacity, filter: `blur(${blur}px)`, force3D: true });
            } else {
              gsap.set(inner, { opacity: 1, filter: "blur(0px)" });
            }
          },
        });
        gsap.set(service, { zIndex: index + 1 });
      });
    };
    initServices();

    // 6. Footer Text Stretch & Visibility Trigger
    const footerHeader = container.querySelector(".footer-header h1");
    const footer = container.querySelector("footer");

    if (footer) {
      ScrollTrigger.create({
        trigger: footer,
        start: "top 80%",
        onEnter: () => footer.classList.add("is-visible"),
        onLeaveBack: () => footer.classList.remove("is-visible"),
      });
    }

    if (footerHeader && !prefersReducedMotion) {
      gsap.to(footerHeader, {
        scrollTrigger: {
          trigger: "footer",
          start: "top 90%",
          end: "bottom bottom",
          scrub: 1,
        },
        scaleY: 4,
        opacity: 0.1,
        ease: "power1.inOut",
      });
    }

    // 7. Interactive Brand Knob Rotation
    if (!prefersReducedMotion) {
      ScrollTrigger.create({
        trigger: "body",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const rotation = self.progress * 360 * 2;
          document.documentElement.style.setProperty("--knob-rotation", `${rotation}deg`);
        },
      });
    }
  }, container);

  const refreshOnResize = () => ScrollTrigger.refresh();
  window.addEventListener("resize", refreshOnResize);

  return () => {
    window.removeEventListener("resize", refreshOnResize);
    if (tickerCallback) {
      gsap.ticker.remove(tickerCallback);
    }
    lenis?.destroy();
    ctx.revert();
  };
}
