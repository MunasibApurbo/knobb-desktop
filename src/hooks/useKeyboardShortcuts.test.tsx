import { fireEvent, renderHook } from "@testing-library/react";

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { APP_HOME_PATH } from "@/lib/routes";

type ActiveScope = {
  id: string;
  selectedCount: number;
  selectAll: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  deleteSelection: ReturnType<typeof vi.fn>;
  collectionActions?: {
    download?: ReturnType<typeof vi.fn>;
    play?: ReturnType<typeof vi.fn>;
    share?: ReturnType<typeof vi.fn>;
    shuffle?: ReturnType<typeof vi.fn>;
    toggleSaved?: ReturnType<typeof vi.fn>;
  };
} | null;

const playerMocks = vi.hoisted(() => ({
  addToQueue: vi.fn(),
  currentTrack: { id: "track-1", title: "Track 1" },
  currentTime: 45,
  duration: 180,
  isPlaying: true,
  next: vi.fn(),
  openRightPanel: vi.fn(),
  playbackMode: "native" as "native" | "youtube-embed",
  playbackSpeed: 1,
  previous: vi.fn(),
  rightPanelTab: "queue" as "lyrics" | "queue",
  seek: vi.fn(),
  setPlaybackSpeed: vi.fn(),
  setRightPanelOpen: vi.fn(),
  setVolume: vi.fn(),
  showRightPanel: false,
  togglePlay: vi.fn(),
  toggleRepeat: vi.fn(),
  toggleRightPanel: vi.fn(),
  toggleShuffle: vi.fn(),
  volume: 0.5,
}));

const likedSongsMocks = vi.hoisted(() => ({
  toggleLike: vi.fn(async () => undefined),
}));

const selectionMocks = vi.hoisted(() => ({
  activeScope: null as ActiveScope,
}));

const sidebarMocks = vi.hoisted(() => ({
  collapsed: false,
  expandPanel: vi.fn(),
  setCollapsed: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const keyboardShortcutMocks = vi.hoisted(() => ({
  dispatchLibraryShortcutCommand: vi.fn(),
}));

const mediaElementMocks = vi.hoisted(() => ({
  getMediaElement: vi.fn(),
  mediaElement: null as (HTMLVideoElement & {
    requestFullscreen: ReturnType<typeof vi.fn>;
    requestPictureInPicture: ReturnType<typeof vi.fn>;
  }) | null,
}));

const youtubeEmbedManagerMocks = vi.hoisted(() => ({
  isPaused: vi.fn(() => true),
}));

function setMediaPaused(paused: boolean) {
  if (!mediaElementMocks.mediaElement) return;

  Object.defineProperty(mediaElementMocks.mediaElement, "paused", {
    configurable: true,
    value: paused,
  });
}

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigationMocks.navigate,
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => likedSongsMocks,
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => playerMocks,
  usePlayerTimeline: () => ({
    currentTime: playerMocks.currentTime,
    duration: playerMocks.duration,
  }),
}));

vi.mock("@/contexts/SidebarContext", () => ({
  useSidebarCollapsed: () => sidebarMocks,
}));

vi.mock("@/contexts/TrackSelectionShortcutsContext", () => ({
  useTrackSelectionShortcutsContext: () => selectionMocks,
}));

vi.mock("@/lib/keyboardShortcuts", () => ({
  dispatchLibraryShortcutCommand: (...args: unknown[]) => keyboardShortcutMocks.dispatchLibraryShortcutCommand(...args),
}));

vi.mock("@/lib/audioEngine", () => ({
  getAudioEngine: () => ({
    getMediaElement: mediaElementMocks.getMediaElement,
  }),
}));

vi.mock("@/lib/youtubeEmbedManager", () => ({
  getYoutubeEmbedManager: () => youtubeEmbedManagerMocks,
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

function createCollectionScope() {
  return {
    id: "playlist:user-owned",
    selectedCount: 0,
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    deleteSelection: vi.fn(),
    collectionActions: {
      download: vi.fn(),
      play: vi.fn(),
      share: vi.fn(),
      shuffle: vi.fn(),
      toggleSaved: vi.fn(),
    },
  };
}

function setPlatform(platform: string) {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    playerMocks.addToQueue.mockReset();
    playerMocks.currentTrack = { id: "track-1", title: "Track 1" };
    playerMocks.currentTime = 45;
    playerMocks.duration = 180;
    playerMocks.isPlaying = true;
    playerMocks.next.mockReset();
    playerMocks.openRightPanel.mockReset();
    playerMocks.playbackMode = "native";
    playerMocks.playbackSpeed = 1;
    playerMocks.previous.mockReset();
    playerMocks.rightPanelTab = "queue";
    playerMocks.seek.mockReset();
    playerMocks.setPlaybackSpeed.mockReset();
    playerMocks.setRightPanelOpen.mockReset();
    playerMocks.setVolume.mockReset();
    playerMocks.showRightPanel = false;
    playerMocks.togglePlay.mockReset();
    playerMocks.toggleRepeat.mockReset();
    playerMocks.toggleRightPanel.mockReset();
    playerMocks.toggleShuffle.mockReset();
    playerMocks.volume = 0.5;
    likedSongsMocks.toggleLike.mockReset();
    selectionMocks.activeScope = null;
    sidebarMocks.collapsed = false;
    sidebarMocks.expandPanel.mockReset();
    sidebarMocks.setCollapsed.mockReset();
    navigationMocks.navigate.mockReset();
    keyboardShortcutMocks.dispatchLibraryShortcutCommand.mockReset();
    mediaElementMocks.mediaElement = document.createElement("video") as HTMLVideoElement & {
      requestFullscreen: ReturnType<typeof vi.fn>;
      requestPictureInPicture: ReturnType<typeof vi.fn>;
    };
    mediaElementMocks.mediaElement.requestFullscreen = vi.fn(async () => undefined);
    mediaElementMocks.mediaElement.requestPictureInPicture = vi.fn(async () => ({}));
    setMediaPaused(true);
    mediaElementMocks.getMediaElement.mockReset();
    mediaElementMocks.getMediaElement.mockReturnValue(mediaElementMocks.mediaElement);
    youtubeEmbedManagerMocks.isPaused.mockReset();
    youtubeEmbedManagerMocks.isPaused.mockReturnValue(true);
    document.body.innerHTML = "";
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    Object.defineProperty(document, "pictureInPictureElement", {
      configurable: true,
      value: null,
    });
    Object.defineProperty(document, "pictureInPictureEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
    Object.defineProperty(document, "exitPictureInPicture", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
    setPlatform("Win32");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles Spotify playback and current-track shortcuts from the page body", () => {
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: " " });
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "m" });

    expect(playerMocks.togglePlay).toHaveBeenCalledTimes(1);
    expect(playerMocks.previous).toHaveBeenCalledTimes(1);
    expect(playerMocks.next).toHaveBeenCalledTimes(1);
    expect(likedSongsMocks.toggleLike).toHaveBeenCalledWith(playerMocks.currentTrack);
    expect(playerMocks.addToQueue).toHaveBeenCalledWith(playerMocks.currentTrack);
    expect(playerMocks.setVolume).toHaveBeenCalledWith(0);
  });

  it("handles YouTube playback and navigation shortcuts on regular playback", () => {
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "k" });
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "l" });
    fireEvent.keyDown(document.body, { key: "Home" });
    fireEvent.keyDown(document.body, { key: "End" });
    fireEvent.keyDown(document.body, { key: "5" });
    fireEvent.keyDown(document.body, { key: "N", shiftKey: true });
    fireEvent.keyDown(document.body, { key: "P", shiftKey: true });

    expect(playerMocks.togglePlay).toHaveBeenCalledTimes(1);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(1, 35);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(2, 55);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(3, 0);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(4, 180);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(5, 90);
    expect(playerMocks.next).toHaveBeenCalledTimes(1);
    expect(playerMocks.previous).toHaveBeenCalledTimes(1);
  });

  it("handles YouTube video shortcuts and prioritizes video seek controls over Spotify arrow bindings", async () => {
    playerMocks.currentTrack = { id: "video-1", title: "Video 1", isVideo: true };
    playerMocks.currentTime = 45;
    playerMocks.duration = 180;
    playerMocks.isPlaying = false;
    playerMocks.showRightPanel = false;
    playerMocks.rightPanelTab = "queue";

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    fireEvent.keyDown(document.body, { key: "," });
    fireEvent.keyDown(document.body, { key: "." });
    fireEvent.keyDown(document.body, { key: "c" });
    fireEvent.keyDown(document.body, { key: "t" });
    fireEvent.keyDown(document.body, { key: "f" });
    fireEvent.keyDown(document.body, { key: "i" });
    fireEvent.keyDown(document.body, { key: ">" });
    fireEvent.keyDown(document.body, { key: "<" });

    expect(playerMocks.seek).toHaveBeenNthCalledWith(1, 40);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(2, 50);
    expect(playerMocks.setVolume).toHaveBeenNthCalledWith(1, 0.55);
    expect(playerMocks.setVolume).toHaveBeenNthCalledWith(2, 0.45);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(3, 45 - 1 / 30);
    expect(playerMocks.seek).toHaveBeenNthCalledWith(4, 45 + 1 / 30);
    expect(playerMocks.openRightPanel).toHaveBeenCalledWith("lyrics");
    expect(playerMocks.toggleRightPanel).toHaveBeenCalledTimes(1);
    expect(playerMocks.setPlaybackSpeed).toHaveBeenNthCalledWith(1, 1.25);
    expect(playerMocks.setPlaybackSpeed).toHaveBeenNthCalledWith(2, 0.8);

    await Promise.resolve();

    expect(mediaElementMocks.mediaElement?.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(mediaElementMocks.mediaElement?.requestPictureInPicture).toHaveBeenCalledTimes(1);
    expect(likedSongsMocks.toggleLike).not.toHaveBeenCalled();
    expect(playerMocks.addToQueue).not.toHaveBeenCalled();
  });

  it("closes lyrics and exits immersive media states on repeated YouTube toggles", async () => {
    playerMocks.currentTrack = { id: "video-1", title: "Video 1", isVideo: true };
    playerMocks.showRightPanel = true;
    playerMocks.rightPanelTab = "lyrics";

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.body,
    });
    Object.defineProperty(document, "pictureInPictureElement", {
      configurable: true,
      value: mediaElementMocks.mediaElement,
    });

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "c" });
    fireEvent.keyDown(document.body, { key: "f" });
    fireEvent.keyDown(document.body, { key: "i" });

    expect(playerMocks.setRightPanelOpen).toHaveBeenCalledWith(false);

    await Promise.resolve();

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(document.exitPictureInPicture).toHaveBeenCalledTimes(1);
  });

  it("resumes a playing video when native fullscreen exits and the media was paused by the browser", async () => {
    vi.useFakeTimers();
    playerMocks.currentTrack = { id: "video-1", title: "Video 1", isVideo: true };
    playerMocks.playbackMode = "native";
    setMediaPaused(false);

    renderHook(() => useKeyboardShortcuts());

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: mediaElementMocks.mediaElement,
    });
    fireEvent(document, new Event("fullscreenchange"));

    setMediaPaused(true);
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    fireEvent(document, new Event("fullscreenchange"));

    await vi.runAllTimersAsync();

    expect(playerMocks.togglePlay).toHaveBeenCalledTimes(1);
  });

  it("does not resume playback after fullscreen exit when the user had already paused the video", async () => {
    vi.useFakeTimers();
    playerMocks.currentTrack = { id: "video-1", title: "Video 1", isVideo: true };
    playerMocks.playbackMode = "native";
    setMediaPaused(false);

    const { rerender } = renderHook(() => useKeyboardShortcuts());

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: mediaElementMocks.mediaElement,
    });
    fireEvent(document, new Event("fullscreenchange"));

    playerMocks.isPlaying = false;
    rerender();

    setMediaPaused(true);
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    fireEvent(document, new Event("fullscreenchange"));

    await vi.runAllTimersAsync();

    expect(playerMocks.togglePlay).not.toHaveBeenCalled();
  });

  it("handles Spotify shuffle and repeat shortcuts for both Windows and Mac layouts", () => {
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "r", ctrlKey: true });

    setPlatform("MacIntel");

    fireEvent.keyDown(document.body, { key: "s", altKey: true });
    fireEvent.keyDown(document.body, { key: "r", altKey: true });

    expect(playerMocks.toggleShuffle).toHaveBeenCalledTimes(2);
    expect(playerMocks.toggleRepeat).toHaveBeenCalledTimes(2);
  });

  it("handles Spotify navigation shortcuts", () => {
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "l", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: ",", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "h", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "m", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "n", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "q", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "r", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "s", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "j", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "l", altKey: true, shiftKey: true });

    expect(navigationMocks.navigate).toHaveBeenNthCalledWith(1, "/search");
    expect(navigationMocks.navigate).toHaveBeenNthCalledWith(2, "/search");
    expect(navigationMocks.navigate).toHaveBeenNthCalledWith(3, "/settings");
    expect(navigationMocks.navigate).toHaveBeenNthCalledWith(4, APP_HOME_PATH);
    expect(navigationMocks.navigate).toHaveBeenNthCalledWith(5, "/home-section/recommended");
    expect(navigationMocks.navigate).toHaveBeenNthCalledWith(6, "/home-section/newreleases");
    expect(navigationMocks.navigate).toHaveBeenNthCalledWith(7, "/liked");
    expect(playerMocks.openRightPanel).toHaveBeenNthCalledWith(1, "queue");
    expect(playerMocks.openRightPanel).toHaveBeenNthCalledWith(2, "lyrics");
    expect(playerMocks.toggleRightPanel).toHaveBeenCalledTimes(1);
    expect(sidebarMocks.setCollapsed).toHaveBeenCalledWith(true);
  });

  it("routes Spotify library shortcuts and selection shortcuts", () => {
    const activeScope = createScope();
    selectionMocks.activeScope = activeScope;

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "f", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "0", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "1", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "3", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "4", altKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "a", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "Delete" });
    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(keyboardShortcutMocks.dispatchLibraryShortcutCommand).toHaveBeenNthCalledWith(1, { type: "focus-search" });
    expect(keyboardShortcutMocks.dispatchLibraryShortcutCommand).toHaveBeenNthCalledWith(2, { type: "set-filter", filter: "all" });
    expect(keyboardShortcutMocks.dispatchLibraryShortcutCommand).toHaveBeenNthCalledWith(3, { type: "set-filter", filter: "playlists" });
    expect(keyboardShortcutMocks.dispatchLibraryShortcutCommand).toHaveBeenNthCalledWith(4, { type: "set-filter", filter: "artists" });
    expect(keyboardShortcutMocks.dispatchLibraryShortcutCommand).toHaveBeenNthCalledWith(5, { type: "set-filter", filter: "albums" });
    expect(sidebarMocks.setCollapsed).toHaveBeenNthCalledWith(1, false);
    expect(sidebarMocks.setCollapsed).toHaveBeenNthCalledWith(2, false);
    expect(sidebarMocks.setCollapsed).toHaveBeenNthCalledWith(3, false);
    expect(sidebarMocks.setCollapsed).toHaveBeenNthCalledWith(4, false);
    expect(sidebarMocks.setCollapsed).toHaveBeenNthCalledWith(5, false);
    expect(activeScope.selectAll).toHaveBeenCalledTimes(1);
    expect(activeScope.deleteSelection).toHaveBeenCalledTimes(1);
    expect(activeScope.clearSelection).toHaveBeenCalledTimes(1);
  });

  it("routes collection action shortcuts for active collection scopes like owned playlists", () => {
    const activeScope = createCollectionScope();
    selectionMocks.activeScope = activeScope;

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "p" });
    fireEvent.keyDown(document.body, { key: "s" });
    fireEvent.keyDown(document.body, { key: "d" });
    fireEvent.keyDown(document.body, { key: "o" });
    fireEvent.keyDown(document.body, { key: "h" });
    fireEvent.keyDown(document.body, { key: "y" });

    expect(activeScope.collectionActions.play).toHaveBeenCalledTimes(1);
    expect(activeScope.collectionActions.shuffle).toHaveBeenCalledTimes(1);
    expect(activeScope.collectionActions.download).toHaveBeenCalledTimes(1);
    expect(activeScope.collectionActions.toggleSaved).toHaveBeenCalledTimes(2);
    expect(activeScope.collectionActions.share).toHaveBeenCalledTimes(1);
  });

  it("supports Spotify's Mac search shortcut", () => {
    setPlatform("MacIntel");

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "L", metaKey: true, shiftKey: true });

    expect(navigationMocks.navigate).toHaveBeenCalledWith("/search");
  });

  it("ignores shortcuts while typing or focusing shortcut-sensitive controls", () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement("input");
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    document.body.append(input, slider);

    fireEvent.keyDown(input, { key: " " });
    fireEvent.keyDown(input, { key: "k", ctrlKey: true });
    fireEvent.keyDown(input, { key: "f", ctrlKey: true });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowDown" });

    expect(playerMocks.togglePlay).not.toHaveBeenCalled();
    expect(playerMocks.addToQueue).not.toHaveBeenCalled();
    expect(playerMocks.next).not.toHaveBeenCalled();
    expect(navigationMocks.navigate).not.toHaveBeenCalled();
    expect(keyboardShortcutMocks.dispatchLibraryShortcutCommand).not.toHaveBeenCalled();
  });

  it("ignores shortcuts while an overlay surface is open even from the page body", () => {
    renderHook(() => useKeyboardShortcuts());

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.append(dialog);

    fireEvent.keyDown(document.body, { key: " " });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });

    expect(playerMocks.togglePlay).not.toHaveBeenCalled();
    expect(playerMocks.addToQueue).not.toHaveBeenCalled();
    expect(navigationMocks.navigate).not.toHaveBeenCalled();
  });

  it("does not let YouTube no-modifier shortcuts override Spotify navigation shortcuts with modifiers", () => {
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "f", ctrlKey: true });

    expect(navigationMocks.navigate).toHaveBeenCalledWith("/search");
    expect(keyboardShortcutMocks.dispatchLibraryShortcutCommand).toHaveBeenCalledWith({ type: "focus-search" });
    expect(playerMocks.togglePlay).not.toHaveBeenCalled();
    expect(mediaElementMocks.mediaElement?.requestFullscreen).not.toHaveBeenCalled();
  });
});
