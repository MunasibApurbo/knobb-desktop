export const ALLOW_NATIVE_CONTEXT_MENU_SELECTOR = "[data-allow-native-context-menu]";

type ContextMenuEventLike = Pick<MouseEvent, "defaultPrevented" | "target">;

export function shouldSuppressNativeContextMenu(event: ContextMenuEventLike) {
  if (event.defaultPrevented) {
    return false;
  }

  return !(event.target instanceof Element && event.target.closest(ALLOW_NATIVE_CONTEXT_MENU_SELECTOR));
}

export function installNativeContextMenuBlocker(target: Window = window) {
  const handleContextMenu = (event: MouseEvent) => {
    if (shouldSuppressNativeContextMenu(event)) {
      event.preventDefault();
    }
  };

  target.addEventListener("contextmenu", handleContextMenu);

  return () => {
    target.removeEventListener("contextmenu", handleContextMenu);
  };
}
