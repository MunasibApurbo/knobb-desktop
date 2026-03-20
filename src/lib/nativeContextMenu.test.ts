import {
  ALLOW_NATIVE_CONTEXT_MENU_SELECTOR,
  installNativeContextMenuBlocker,
  shouldSuppressNativeContextMenu,
} from "@/lib/nativeContextMenu";

describe("native context menu", () => {
  it("suppresses the browser menu for regular elements", () => {
    const target = document.createElement("div");

    expect(shouldSuppressNativeContextMenu({ defaultPrevented: false, target })).toBe(true);
  });

  it("allows explicit escape-hatch regions to keep the browser menu", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-allow-native-context-menu", "");
    const target = document.createElement("button");
    wrapper.appendChild(target);

    expect(ALLOW_NATIVE_CONTEXT_MENU_SELECTOR).toBe("[data-allow-native-context-menu]");
    expect(shouldSuppressNativeContextMenu({ defaultPrevented: false, target })).toBe(false);
  });

  it("does not interfere when another handler already prevented the event", () => {
    const target = document.createElement("div");

    expect(shouldSuppressNativeContextMenu({ defaultPrevented: true, target })).toBe(false);
  });

  it("prevents the native menu once installed on window", () => {
    const cleanup = installNativeContextMenuBlocker(window);
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    cleanup();
  });
});
