import { useEffect } from "react";

const landingDocumentScrollState = {
  activeInstances: 0,
  htmlOverflowY: "",
  htmlOverscrollBehaviorY: "",
  bodyOverflow: "",
  bodyOverflowX: "",
  bodyOverflowY: "",
  bodyOverscrollBehavior: "",
};

export function useLandingDocumentScroll() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const { documentElement, body } = document;
    if (!body) return;

    if (landingDocumentScrollState.activeInstances === 0) {
      landingDocumentScrollState.htmlOverflowY = documentElement.style.overflowY;
      landingDocumentScrollState.htmlOverscrollBehaviorY = documentElement.style.overscrollBehaviorY;
      landingDocumentScrollState.bodyOverflow = body.style.overflow;
      landingDocumentScrollState.bodyOverflowX = body.style.overflowX;
      landingDocumentScrollState.bodyOverflowY = body.style.overflowY;
      landingDocumentScrollState.bodyOverscrollBehavior = body.style.overscrollBehavior;
    }

    landingDocumentScrollState.activeInstances += 1;

    documentElement.style.overflowY = "auto";
    documentElement.style.overscrollBehaviorY = "auto";
    body.style.overflow = "auto";
    body.style.overflowX = "hidden";
    body.style.overflowY = "auto";
    body.style.overscrollBehavior = "auto";

    return () => {
      landingDocumentScrollState.activeInstances = Math.max(0, landingDocumentScrollState.activeInstances - 1);

      if (landingDocumentScrollState.activeInstances > 0) {
        return;
      }

      documentElement.style.overflowY = landingDocumentScrollState.htmlOverflowY;
      documentElement.style.overscrollBehaviorY = landingDocumentScrollState.htmlOverscrollBehaviorY;
      body.style.overflow = landingDocumentScrollState.bodyOverflow;
      body.style.overflowX = landingDocumentScrollState.bodyOverflowX;
      body.style.overflowY = landingDocumentScrollState.bodyOverflowY;
      body.style.overscrollBehavior = landingDocumentScrollState.bodyOverscrollBehavior;
    };
  }, []);
}
