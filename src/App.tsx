import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NavigationIntentPreloader } from "@/components/NavigationIntentPreloader";
import { applyMetadata, getRouteMetadata } from "@/lib/metadata";
import { APP_HOME_PATH, CONTACT_PATH, PUBLIC_HOME_PATH } from "@/lib/routes";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const LandingContactPage = lazy(() => import("./pages/landing/LandingContactPage"));
const InternalApp = lazy(() => import("./InternalApp"));

function AppRouteFallback() {
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname !== PUBLIC_HOME_PATH) {
      return null;
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black px-6 py-10 text-center text-[0.72rem] uppercase tracking-[0.28em] text-white/40">
      Loading Knobb
    </div>
  );
}

function RouteMetadataEffect() {
  const location = useLocation();

  useEffect(() => {
    applyMetadata(getRouteMetadata(location.pathname, location.search));
  }, [location.pathname, location.search]);

  return null;
}

const App = () => {
  const isDesktopApp = typeof window !== "undefined" && Boolean(window.knobbDesktop?.isDesktopApp);

  return (
    <BrowserRouter>
      <NavigationIntentPreloader />
      <RouteMetadataEffect />
      <Suspense fallback={<AppRouteFallback />}>
        <Routes>
          <Route
            path={PUBLIC_HOME_PATH}
            element={isDesktopApp ? <Navigate to={APP_HOME_PATH} replace /> : <LandingPage />}
          />
          <Route path={CONTACT_PATH} element={<LandingContactPage />} />
          <Route path="*" element={<InternalApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
