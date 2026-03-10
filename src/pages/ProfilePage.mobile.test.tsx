import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ProfilePage from "@/pages/ProfilePage";

const profilePageMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  profileData: {
    user: {
      id: "user-1",
      email: "listener@example.com",
      created_at: "2026-01-05T00:00:00.000Z",
    },
    loading: false,
    saving: false,
    displayName: "Knobb Listener",
    draftDisplayName: "Knobb Listener",
    heroImage: null,
    range: "30d" as const,
    stats: {
      totalCountedPlays: 24,
      totalMinutes: 128,
      peakHour: 20,
      hourCounts: Array.from({ length: 24 }, (_value, index) => (index === 20 ? 8 : 2)),
      topArtists: [],
      topTracks: [],
    },
    artistImages: {},
    maxHour: 8,
    imageSrc: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    isRenameDialogOpen: false,
    isCropDialogOpen: false,
    fileInputRef: { current: null },
    setDraftDisplayName: vi.fn(),
    setRange: vi.fn(),
    setCrop: vi.fn(),
    setZoom: vi.fn(),
    setIsRenameDialogOpen: vi.fn(),
    setIsCropDialogOpen: vi.fn(),
    saveProfile: vi.fn(),
    openImagePicker: vi.fn(),
    handleImageUpload: vi.fn(),
    onCropComplete: vi.fn(),
    showCroppedImage: vi.fn(),
    clearCropSource: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signOut: profilePageMocks.signOut,
  }),
}));

vi.mock("@/hooks/useProfilePageData", () => ({
  useProfilePageData: () => profilePageMocks.profileData,
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/profile/ProfileHero", () => ({
  ProfileHero: () => <div data-testid="profile-hero">Profile hero</div>,
}));

vi.mock("@/components/profile/ProfileStatsSection", () => ({
  ProfileStatsSection: () => <div data-testid="profile-stats">Profile stats</div>,
}));

vi.mock("@/components/profile/ProfileRenameDialog", () => ({
  ProfileRenameDialog: () => null,
}));

vi.mock("@/components/profile/ProfileCropDialog", () => ({
  ProfileCropDialog: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: ComponentPropsWithoutRef<"div">) => <div {...props}>{children}</div>,
  },
  useScroll: () => ({
    scrollY: {
      get: () => 0,
    },
  }),
}));

describe("ProfilePage mobile layout", () => {
  it("renders the profile shell with stacked mobile content", () => {
    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    const shell = container.querySelector(".mobile-page-shell");

    expect(shell).not.toBeNull();
    expect(shell).not.toHaveClass("h-full");
    expect(screen.getByTestId("profile-hero")).toBeInTheDocument();
    expect(screen.getByTestId("profile-stats")).toBeInTheDocument();
  });
});
