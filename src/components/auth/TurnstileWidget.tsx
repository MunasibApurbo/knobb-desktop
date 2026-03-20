import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise: Promise<void> | null = null;
const TURNSTILE_SCRIPT_STATUS_ATTR = "data-turnstile-status";

function markTurnstileScriptStatus(script: HTMLScriptElement, status: "loading" | "loaded" | "error") {
  script.setAttribute(TURNSTILE_SCRIPT_STATUS_ATTR, status);
}

function loadTurnstileScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile can only load in the browser."));
  }

  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript?.getAttribute(TURNSTILE_SCRIPT_STATUS_ATTR) === "loaded") {
      resolve();
      return;
    }

    const script = existingScript?.getAttribute(TURNSTILE_SCRIPT_STATUS_ATTR) === "error"
      ? (() => {
          existingScript.remove();
          return null;
        })()
      : existingScript;

    const activeScript = script ?? document.createElement("script");
    if (!script) {
      activeScript.id = TURNSTILE_SCRIPT_ID;
      activeScript.src = TURNSTILE_SCRIPT_SRC;
      activeScript.async = true;
      activeScript.defer = true;
      markTurnstileScriptStatus(activeScript, "loading");
      document.head.appendChild(activeScript);
    }

    activeScript.addEventListener("load", () => {
      markTurnstileScriptStatus(activeScript, "loaded");
      resolve();
    }, { once: true });
    activeScript.addEventListener("error", () => {
      markTurnstileScriptStatus(activeScript, "error");
      turnstileScriptPromise = null;
      reject(new Error("Failed to load Turnstile."));
    }, { once: true });
  });

  return turnstileScriptPromise;
}

type TurnstileWidgetProps = {
  siteKey: string;
  resetSignal: number;
  onTokenChange: (token: string | null) => void;
  onLoadError: (message: string) => void;
};

export function TurnstileWidget({
  siteKey,
  resetSignal,
  onTokenChange,
  onLoadError,
}: TurnstileWidgetProps) {
  const containerId = useId();
  const widgetIdRef = useRef<string | null>(null);
  const hasRenderedRef = useRef(false);
  const tokenChangeRef = useRef(onTokenChange);
  const loadErrorRef = useRef(onLoadError);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    tokenChangeRef.current = onTokenChange;
    loadErrorRef.current = onLoadError;
  }, [onLoadError, onTokenChange]);

  useEffect(() => {
    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || hasRenderedRef.current) return;

        widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          callback: (token) => {
            tokenChangeRef.current(token);
          },
          "expired-callback": () => {
            tokenChangeRef.current(null);
          },
          "timeout-callback": () => {
            tokenChangeRef.current(null);
          },
          "error-callback": () => {
            tokenChangeRef.current(null);
            loadErrorRef.current("Captcha verification failed. Reload the challenge and try again.");
          },
        });

        hasRenderedRef.current = true;
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load captcha verification.";
        loadErrorRef.current(message);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      hasRenderedRef.current = false;
    };
  }, [containerId, siteKey]);

  useEffect(() => {
    if (!resetSignal || !widgetIdRef.current || !window.turnstile) return;
    tokenChangeRef.current(null);
    window.turnstile.reset(widgetIdRef.current);
  }, [resetSignal]);

  return (
    <div className="space-y-2">
      <div
        id={containerId}
        className="min-h-[65px] border border-white/10 bg-white/[0.02] px-2 py-2"
      />
      {!ready ? <p className="text-xs text-muted-foreground">Loading captcha challenge...</p> : null}
    </div>
  );
}
