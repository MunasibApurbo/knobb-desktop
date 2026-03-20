import { toast } from "sonner";

type ToastMethod = "error" | "info" | "success" | "warning";

function showToast(method: ToastMethod, message: string) {
  if (typeof window === "undefined") return;

  toast[method](message);
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
