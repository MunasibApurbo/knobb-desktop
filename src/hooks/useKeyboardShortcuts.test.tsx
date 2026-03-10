import { fireEvent, renderHook } from "@testing-library/react";

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

type ActiveScope = {
  id: string;
  selectedCount: number;
  selectAll: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  deleteSelection: ReturnType<typeof vi.fn>;
} | null;

const playerMocks = vi.hoisted(() => ({
  togglePlay: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  volume: 0.5,
  setVolume: vi.fn(),
  currentTrack: { id: "track-1" },
  seek: vi.fn(),
  currentTime: 45,
  duration: 180,
}));

const selectionMocks = vi.hoisted(() => ({
  activeScope: null as ActiveScope,
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => playerMocks,
  usePlayerTimeline: () => ({
    currentTime: playerMocks.currentTime,
    duration: playerMocks.duration,
  }),
}));

vi.mock("@/contexts/TrackSelectionShortcutsContext", () => ({
  useTrackSelectionShortcutsContext: () => selectionMocks,
}));

function createScope() {
  return {
    id: "liked-songs",
    selectedCount: 3,
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    deleteSelection: vi.fn(),
  };
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    playerMocks.togglePlay.mockReset();
    playerMocks.next.mockReset();
    playerMocks.previous.mockReset();
    playerMocks.setVolume.mockReset();
    playerMocks.seek.mockReset();
    playerMocks.volume = 0.5;
    playerMocks.currentTrack = { id: "track-1" };
    playerMocks.currentTime = 45;
    playerMocks.duration = 180;
    selectionMocks.activeScope = null;
    document.body.innerHTML = "";
  });

  it("handles global playback shortcuts from the page body", () => {
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "k" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "m" });

    expect(playerMocks.togglePlay).toHaveBeenCalledTimes(1);
    expect(playerMocks.seek).toHaveBeenCalledWith(50);
    expect(playerMocks.setVolume).toHaveBeenCalledWith(0);
  });

  it("ignores shortcuts while typing or focusing real controls", () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement("input");
    const button = document.createElement("button");
    document.body.append(input, button);

    fireEvent.keyDown(input, { key: "k" });
    fireEvent.keyDown(button, { key: " " });
    fireEvent.keyDown(button, { key: "ArrowRight" });

    expect(playerMocks.togglePlay).not.toHaveBeenCalled();
    expect(playerMocks.seek).not.toHaveBeenCalled();
  });

  it("still allows shortcuts right after focusing a track row", () => {
    renderHook(() => useKeyboardShortcuts());

    const trackRow = document.createElement("div");
    trackRow.setAttribute("role", "button");
    trackRow.tabIndex = 0;
    document.body.append(trackRow);

    fireEvent.keyDown(trackRow, { key: "k" });
    fireEvent.keyDown(trackRow, { key: "ArrowRight" });

    expect(playerMocks.togglePlay).toHaveBeenCalledTimes(1);
    expect(playerMocks.seek).toHaveBeenCalledWith(50);
  });

  it("still allows space play pause when a focused row handles enter only", () => {
    renderHook(() => useKeyboardShortcuts());

    const trackRow = document.createElement("div");
    trackRow.setAttribute("role", "button");
    trackRow.tabIndex = 0;
    trackRow.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
      }
    });
    document.body.append(trackRow);

    fireEvent.keyDown(trackRow, { key: " " });

    expect(playerMocks.togglePlay).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts while focus is inside overlay surfaces", () => {
    renderHook(() => useKeyboardShortcuts());

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const dialogBody = document.createElement("div");
    dialog.append(dialogBody);
    document.body.append(dialog);

    fireEvent.keyDown(dialogBody, { key: "ArrowRight" });
    fireEvent.keyDown(dialogBody, { key: "Delete" });

    expect(playerMocks.seek).not.toHaveBeenCalled();
  });

  it("ignores shortcuts while an overlay surface is open even from the page body", () => {
    renderHook(() => useKeyboardShortcuts());

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.append(dialog);

    fireEvent.keyDown(document.body, { key: "k" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "m" });

    expect(playerMocks.togglePlay).not.toHaveBeenCalled();
    expect(playerMocks.seek).not.toHaveBeenCalled();
    expect(playerMocks.setVolume).not.toHaveBeenCalled();
  });

  it("runs selection shortcuts when a track scope is active", () => {
    const activeScope = createScope();
    selectionMocks.activeScope = activeScope;

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "a", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "Delete" });
    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(activeScope.selectAll).toHaveBeenCalledTimes(1);
    expect(activeScope.deleteSelection).toHaveBeenCalledTimes(1);
    expect(activeScope.clearSelection).toHaveBeenCalledTimes(1);
  });

  it("runs selection shortcuts from focused non-editable buttons", () => {
    const activeScope = createScope();
    selectionMocks.activeScope = activeScope;

    renderHook(() => useKeyboardShortcuts());

    const button = document.createElement("button");
    document.body.append(button);

    fireEvent.keyDown(button, { key: "a", ctrlKey: true });
    fireEvent.keyDown(button, { key: "Delete" });
    fireEvent.keyDown(button, { key: "Escape" });

    expect(activeScope.selectAll).toHaveBeenCalledTimes(1);
    expect(activeScope.deleteSelection).toHaveBeenCalledTimes(1);
    expect(activeScope.clearSelection).toHaveBeenCalledTimes(1);
  });

  it("does not run selection shortcuts from editable fields", () => {
    const activeScope = createScope();
    selectionMocks.activeScope = activeScope;

    renderHook(() => useKeyboardShortcuts());

    const textarea = document.createElement("textarea");
    document.body.append(textarea);

    fireEvent.keyDown(textarea, { key: "a", ctrlKey: true });
    fireEvent.keyDown(textarea, { key: "Delete" });
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(activeScope.selectAll).not.toHaveBeenCalled();
    expect(activeScope.deleteSelection).not.toHaveBeenCalled();
    expect(activeScope.clearSelection).not.toHaveBeenCalled();
  });
});
