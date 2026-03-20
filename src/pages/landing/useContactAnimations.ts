type ContactAnimationOptions = {
  lowEndDevice?: boolean;
  prefersReducedMotion?: boolean;
};

export function startContactAnimations(
  containerRef: HTMLDivElement,
  options: ContactAnimationOptions = {},
) {
  const lowEndDevice = options.lowEndDevice === true;
  const prefersReducedMotion = options.prefersReducedMotion === true;
  const container = containerRef.querySelector(".trail-container") as HTMLElement;
  if (!container) return () => undefined;

  let isDesktop = window.innerWidth > 1000;
  let animationId: number | null = null;
  let mouseMoveListener: ((e: MouseEvent) => void) | null = null;

  const config = {
    imageLifespan: 800,
    removalDelay: 60,
    mouseThreshold: 80,
    inDuration: 600,
    outDuration: 800,
    inEasing: "cubic-bezier(.07,.5,.5,1)",
    outEasing: "cubic-bezier(.87, 0, .13, 1)",
  };

  const images = [
    "/images/knobb/sub_urban.png",
    "/images/knobb/imagine_dragons.png",
    "/images/knobb/bebe_rexha.png",
    "/images/knobb/ai_curation.png",
    "/images/knobb/hifi_audio.png",
    "/images/knobb/dynamic_ui.png",
    "/images/knobb/global_sync.png",
    "/images/knobb/hero_abstract.png",
  ];

  interface TrailItem {
    element: HTMLImageElement;
    rotation: number;
    removeTime: number;
  }
  const trail: TrailItem[] = [];

  let mouseX = 0;
  let mouseY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastRemovalTime = 0;

  const createFloatingElements = () => {
    const floatingContainer = containerRef.querySelector(".floating-elements");
    if (!floatingContainer) return;
    floatingContainer.innerHTML = "";
    for (let i = 0; i < 12; i += 1) {
      const element = document.createElement("div");
      element.className = "floating-element";
      element.style.left = `${Math.random() * 100}%`;
      element.style.animationDelay = `${Math.random() * 8}s`;
      element.style.animationDuration = `${8 + Math.random() * 4}s`;
      floatingContainer.appendChild(element);
    }
  };

  const isInContainer = (x: number, y: number) => {
    const rect = container.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const hasMovedEnough = () => {
    const distance = Math.sqrt(
      Math.pow(mouseX - lastMouseX, 2) + Math.pow(mouseY - lastMouseY, 2),
    );
    return distance > config.mouseThreshold;
  };

  const createImage = () => {
    const img = document.createElement("img");
    img.classList.add("trail-img");
    img.loading = "lazy";
    img.decoding = "async";
    const randomIndex = Math.floor(Math.random() * images.length);
    const rotation = (Math.random() - 0.5) * 40;
    img.src = images[randomIndex];
    const rect = container.getBoundingClientRect();
    const relativeX = mouseX - rect.left;
    const relativeY = mouseY - rect.top;
    img.style.left = `${relativeX}px`;
    img.style.top = `${relativeY}px`;
    img.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(0)`;
    img.style.transition = `transform ${config.inDuration}ms ${config.inEasing}`;
    container.appendChild(img);

    setTimeout(() => {
      img.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(1)`;
    }, 10);

    trail.push({
      element: img,
      rotation,
      removeTime: Date.now() + config.imageLifespan,
    });
  };

  const removeOldImages = () => {
    const now = Date.now();
    if (now - lastRemovalTime < config.removalDelay || trail.length === 0) return;
    const oldestImage = trail[0];
    if (now >= oldestImage.removeTime) {
      const imgToRemove = trail.shift();
      if (imgToRemove) {
        imgToRemove.element.style.transition = `transform ${config.outDuration}ms ${config.outEasing}`;
        imgToRemove.element.style.transform = `translate(-50%, -50%) rotate(${imgToRemove.rotation}deg) scale(0)`;
        lastRemovalTime = now;
        setTimeout(() => {
          if (imgToRemove.element.parentNode) {
            imgToRemove.element.parentNode.removeChild(imgToRemove.element);
          }
        }, config.outDuration);
      }
    }
  };

  const startAnimation = () => {
    if (!isDesktop || lowEndDevice || prefersReducedMotion) return;
    let lastMouseTime = 0;
    mouseMoveListener = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMouseTime < 30) return;
      lastMouseTime = now;

      mouseX = e.clientX;
      mouseY = e.clientY;
      if (isInContainer(mouseX, mouseY) && hasMovedEnough()) {
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        createImage();
      }
    };
    document.addEventListener("mousemove", mouseMoveListener);
    const animate = () => {
      removeOldImages();
      animationId = requestAnimationFrame(animate);
    };
    animate();
  };

  const stopAnimation = () => {
    if (mouseMoveListener) {
      document.removeEventListener("mousemove", mouseMoveListener);
      mouseMoveListener = null;
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    trail.forEach((item) => {
      if (item.element.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });
    trail.length = 0;
  };

  const handleResize = () => {
    const wasDesktop = isDesktop;
    isDesktop = window.innerWidth > 1000;
    if (isDesktop && !wasDesktop) {
      startAnimation();
    } else if (!isDesktop && wasDesktop) {
      stopAnimation();
    }
  };

  window.addEventListener("resize", handleResize);
  createFloatingElements();
  if (isDesktop) startAnimation();

  return () => {
    window.removeEventListener("resize", handleResize);
    stopAnimation();
  };
}
