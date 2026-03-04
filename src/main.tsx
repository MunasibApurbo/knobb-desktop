import { createRoot, Root } from "react-dom/client";
import React, { Component, ReactNode } from "react";
import "./index.css";

type AppModule = { default: React.ComponentType };

function renderBootMessage(root: Root, title: string, detail?: string) {
  root.render(
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full border border-white/15 bg-black/80 p-5">
        <h1 className="text-lg font-semibold">{title}</h1>
        {detail && <pre className="mt-3 text-xs text-red-300 whitespace-pre-wrap break-words">{detail}</pre>}
      </div>
    </div>
  );
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
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full border border-white/15 bg-black/80 p-5">
            <h1 className="text-lg font-semibold">App render failed</h1>
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
renderBootMessage(root, "Loading Nobbb...");

window.addEventListener("error", (event) => {
  console.error("Window error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

import("./App.tsx")
  .then((module: AppModule) => {
    const App = module.default;
    root.render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    );
  })
  .catch((error) => {
    console.error("Failed to bootstrap app:", error);
    renderBootMessage(root, "App bootstrap failed", String(error?.message || error));
  });
