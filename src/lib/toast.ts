type ToastMethod = "error" | "info" | "success" | "warning";

let sonnerToastPromise: Promise<typeof import("sonner")["toast"]> | null = null;

function loadToast() {
  if (!sonnerToastPromise) {
    sonnerToastPromise = import("sonner").then((module) => module.toast);
  }

  return sonnerToastPromise;
}

function showToast(method: ToastMethod, message: string) {
  if (typeof window === "undefined") return;

  void loadToast()
    .then((toast) => {
      toast[method](message);
    })
    .catch(() => undefined);
}

export function showErrorToast(message: string) {
  showToast("error", message);
}

export function showInfoToast(message: string) {
  showToast("info", message);
}

export function showSuccessToast(message: string) {
  showToast("success", message);
}

export function showWarningToast(message: string) {
  showToast("warning", message);
}
