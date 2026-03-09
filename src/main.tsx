import { createRoot } from "react-dom/client";
import React, { Component, ReactNode } from "react";
import { reportClientErrorLazy } from "@/lib/runtimeModules";
import { isKnobbDesktopApp } from "@/lib/desktopApp";
import "./index.css";

type AppModule = { default: React.ComponentType };

function scheduleNonCriticalTask(task: () => void, timeout = 1500) {
  if (typeof window === "undefined") {
    task();
    return () => undefined;
  }

  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(task, Math.min(timeout, 900));
  return () => window.clearTimeout(timeoutId);
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("React render error:", error, info);
    void reportClientErrorLazy(error, "react_render_error", {
      componentStack: info.componentStack || "",
    });
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full border border-white/15 bg-black/80 p-5">
            <h1 className="text-lg font-semibold">Knobb failed to render</h1>
            <pre className="mt-3 text-xs text-red-300 whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

const root = createRoot(rootElement);

window.addEventListener("error", (event) => {
  console.error("Window error:", event.error || event.message);
  void reportClientErrorLazy(event.error || event.message, "window_error", {
    filename: event.filename || "",
    lineno: event.lineno || 0,
    colno: event.colno || 0,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  void reportClientErrorLazy(event.reason, "unhandled_promise_rejection");
});

import("./App.tsx")
  .then((module: AppModule) => {
    const App = module.default;
    const desktopApp = isKnobbDesktopApp();

    root.render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    );

    scheduleNonCriticalTask(() => {
      void import("@/lib/localDiscordPresenceBridge")
        .then((bridgeModule) => {
          bridgeModule.installLocalDiscordPresenceBridge();
        })
        .catch(() => undefined);

      if ("serviceWorker" in navigator && !desktopApp) {
        void navigator.serviceWorker.register("/sw.js").catch((error) => {
          console.error("Service worker registration failed:", error);
        });
      }

      if ("serviceWorker" in navigator && desktopApp) {
        void navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch(() => undefined);
      }
    });
  })
  .catch((error) => {
    console.error("Failed to bootstrap app:", error);
    void reportClientErrorLazy(error, "app_bootstrap_failed");
    root.render(
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full border border-white/15 bg-black/80 p-5">
          <h1 className="text-lg font-semibold">Knobb failed to start</h1>
          <pre className="mt-3 text-xs text-red-300 whitespace-pre-wrap break-words">
            {String(error?.message || error)}
          </pre>
        </div>
      </div>
    );
  });
