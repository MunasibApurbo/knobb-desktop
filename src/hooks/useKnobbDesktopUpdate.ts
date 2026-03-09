import { useCallback, useEffect, useState } from "react";

import {
  checkKnobbDesktopForUpdates,
  getKnobbDesktop,
  getKnobbDesktopUpdateStatus,
  installKnobbDesktopUpdate,
  isKnobbDesktopApp,
  quitKnobbDesktopApp,
  type KnobbDesktopUpdateStatus,
} from "@/lib/desktopApp";

export function useKnobbDesktopUpdate() {
  const desktopApp = isKnobbDesktopApp();
  const [status, setStatus] = useState<KnobbDesktopUpdateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(desktopApp);

  useEffect(() => {
    if (!desktopApp) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    const desktop = getKnobbDesktop();
    const unsubscribe = desktop?.onUpdateStatus?.((nextStatus) => {
      if (!active) return;
      setStatus(nextStatus);
      setIsLoading(false);
    }) || (() => undefined);

    void getKnobbDesktopUpdateStatus()
      .then((nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [desktopApp]);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await checkKnobbDesktopForUpdates();
    if (nextStatus) {
      setStatus(nextStatus);
    }
    return nextStatus;
  }, []);

  const installUpdate = useCallback(async () => {
    return await installKnobbDesktopUpdate();
  }, []);

  const quitApp = useCallback(async () => {
    return await quitKnobbDesktopApp();
  }, []);

  return {
    desktopApp,
    isLoading,
    installUpdate,
    quitApp,
    refreshStatus,
    status,
  };
}
