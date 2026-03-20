type TransitionOptions = {
  lowEndDevice?: boolean;
  prefersReducedMotion?: boolean;
};

function animateElement(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
) {
  if (typeof element.animate !== "function") {
    return null;
  }

  return element.animate(keyframes, options);
}

export function playLandingTransition(
  container: HTMLElement,
  options: TransitionOptions = {},
) {
  const transition = container.querySelector<HTMLElement>(".transition");
  if (!transition) {
    return () => undefined;
  }

  if (transition.dataset.transitionState === "playing" || transition.dataset.transitionState === "done") {
    return () => undefined;
  }

  transition.dataset.transitionState = "playing";

  if (options.lowEndDevice === true) {
    transition.dataset.transitionState = "done";
    transition.style.display = "none";
    return () => undefined;
  }

  const prefersReducedMotion = options.prefersReducedMotion === true;
  const overlays = Array.from(transition.querySelectorAll<HTMLElement>(".transition-overlay"));
  const logo = transition.querySelector<HTMLElement>(".transition-logo-container");
  const animations: Animation[] = [];
  const overlayDuration = prefersReducedMotion ? 380 : 1050;
  const overlayStagger = prefersReducedMotion ? 45 : 90;
  const logoDelay = prefersReducedMotion ? 0 : 420;
  const logoDuration = prefersReducedMotion ? 320 : 900;
  const cleanupDelay = Math.max(
    overlays.length > 0 ? overlayDuration + overlayStagger * Math.max(overlays.length - 1, 0) : 0,
    logo ? logoDelay + logoDuration : 0,
  );

  overlays.forEach((overlay, index) => {
    const animation = animateElement(
      overlay,
      [
        { transform: "scaleY(1)", transformOrigin: "top" },
        { transform: "scaleY(0)", transformOrigin: "top" },
      ],
      {
        duration: overlayDuration,
        delay: index * overlayStagger,
        easing: "cubic-bezier(0.77, 0, 0.175, 1)",
        fill: "forwards",
      },
    );

    if (animation) {
      animations.push(animation);
    } else {
      overlay.style.transformOrigin = "top";
      overlay.style.transition = `transform ${overlayDuration}ms cubic-bezier(0.77, 0, 0.175, 1) ${index * overlayStagger}ms`;
      overlay.style.transform = "scaleY(0)";
    }
  });

  if (logo) {
    const animation = animateElement(
      logo,
      [
        { transform: "scaleY(1)", transformOrigin: "top", opacity: 1 },
        { transform: "scaleY(0)", transformOrigin: "top", opacity: prefersReducedMotion ? 0 : 0.02 },
      ],
      {
        duration: logoDuration,
        delay: logoDelay,
        easing: "cubic-bezier(0.77, 0, 0.175, 1)",
        fill: "forwards",
      },
    );

    if (animation) {
      animations.push(animation);
    } else {
      logo.style.transformOrigin = "top";
      logo.style.transition = `transform ${logoDuration}ms cubic-bezier(0.77, 0, 0.175, 1) ${logoDelay}ms, opacity ${Math.max(220, logoDuration - 120)}ms ease ${logoDelay}ms`;
      logo.style.transform = "scaleY(0)";
      logo.style.opacity = prefersReducedMotion ? "0" : "0.02";
    }
  }

  const hideTransition = () => {
    transition.dataset.transitionState = "done";
    transition.style.display = "none";
  };

  const timeoutId = window.setTimeout(hideTransition, cleanupDelay + 120);

  return () => {
    if (!document.contains(transition)) {
      window.clearTimeout(timeoutId);
      animations.forEach((animation) => animation.cancel());
    }
  };
}
