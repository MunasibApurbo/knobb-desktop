type HapticPattern = number | number[];

function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function triggerHapticFeedback(pattern: HapticPattern) {
  if (!canVibrate()) return false;

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function triggerSelectionHaptic() {
  return triggerHapticFeedback(10);
}

export function triggerSuccessHaptic() {
  return triggerHapticFeedback([14, 24, 20]);
}

export function triggerImpactHaptic(style: "light" | "medium" | "heavy" = "light") {
  switch (style) {
    case "heavy":
      return triggerHapticFeedback([18, 20, 12]);
    case "medium":
      return triggerHapticFeedback(16);
    case "light":
    default:
      return triggerHapticFeedback(10);
  }
}
