const bridgeDot = document.getElementById("bridge-dot");
const bridgeLabel = document.getElementById("bridge-label");
const discordDot = document.getElementById("discord-dot");
const discordLabel = document.getElementById("discord-label");
const updateDot = document.getElementById("update-dot");
const updateLabel = document.getElementById("update-label");
const clientId = document.getElementById("client-id");
const bridgePort = document.getElementById("bridge-port");
const currentVersion = document.getElementById("current-version");
const availableVersion = document.getElementById("available-version");
const updateDetail = document.getElementById("update-detail");
const lastError = document.getElementById("last-error");
const activityPanel = document.getElementById("activity-panel");
const activityTitle = document.getElementById("activity-title");
const activityArtist = document.getElementById("activity-artist");
const activityState = document.getElementById("activity-state");
const checkUpdatesButton = document.getElementById("check-updates");
const installUpdateButton = document.getElementById("install-update");

function setDot(element, state) {
  element.className = `dot ${state}`;
}

function renderStatus(status) {
  if (!status) return;

  clientId.textContent = status.configured ? "Configured" : "Missing config";
  bridgePort.textContent = status.port ? String(status.port) : "-";
  lastError.textContent = status.lastError || "None";

  if (!status.ok || !status.configured) {
    setDot(bridgeDot, "warn");
    bridgeLabel.textContent = status.configured ? "Bridge offline" : "Bridge needs setup";
  } else {
    setDot(bridgeDot, "ok");
    bridgeLabel.textContent = "Bridge running";
  }

  if (status.discordConnected) {
    setDot(discordDot, "ok");
    discordLabel.textContent = "Discord desktop connected";
  } else {
    setDot(discordDot, "warn");
    discordLabel.textContent = "Open Discord desktop";
  }

  if (status.currentActivity) {
    activityPanel.classList.add("show");
    activityTitle.textContent = status.currentActivity.details || "-";
    activityArtist.textContent = status.currentActivity.state || "-";
    activityState.textContent = status.currentActivity.smallImageText || "-";
  } else {
    activityPanel.classList.remove("show");
  }
}

function getUpdateDetail(status) {
  switch (status?.status) {
    case "disabled":
      return "Auto-updates work in packaged macOS and Windows builds.";
    case "not-configured":
      return "This packaged build is missing its bundled updater configuration.";
    case "checking":
      return "Checking GitHub Releases for a newer companion build.";
    case "downloading":
      return status.downloadProgress != null
        ? `Downloading the latest release (${Math.round(status.downloadProgress)}%).`
        : "Downloading the latest release.";
    case "downloaded":
      return "The latest companion update is ready. Restart to install it.";
    case "error":
      return status.lastError || "The last update check failed.";
    case "idle":
    default:
      return "Background update checks are active.";
  }
}

function renderUpdateStatus(status) {
  if (!status) return;

  currentVersion.textContent = status.currentVersion || "-";
  availableVersion.textContent = status.updateInfo?.version || "Latest installed";
  updateDetail.textContent = getUpdateDetail(status);

  switch (status.status) {
    case "checking":
      setDot(updateDot, "sync");
      updateLabel.textContent = "Checking for updates";
      break;
    case "downloading":
      setDot(updateDot, "sync");
      updateLabel.textContent = status.downloadProgress != null
        ? `Downloading ${Math.round(status.downloadProgress)}%`
        : "Downloading update";
      break;
    case "downloaded":
      setDot(updateDot, "ok");
      updateLabel.textContent = "Restart to update";
      break;
    case "error":
      setDot(updateDot, "warn");
      updateLabel.textContent = "Update check failed";
      break;
    case "disabled":
    case "not-configured":
      setDot(updateDot, "warn");
      updateLabel.textContent = "Updates unavailable";
      break;
    case "idle":
    default:
      setDot(updateDot, "ok");
      updateLabel.textContent = "Auto-updates active";
      break;
  }

  checkUpdatesButton.disabled = status.status === "checking" || status.status === "downloading";
  checkUpdatesButton.textContent = status.status === "checking"
    ? "Checking..."
    : status.status === "downloading"
      ? "Downloading..."
      : "Check for updates";

  installUpdateButton.hidden = status.status !== "downloaded";
  installUpdateButton.disabled = status.status !== "downloaded";
}

document.getElementById("open-knobb")?.addEventListener("click", () => {
  void window.knobbDiscordCompanion.openKnobb();
});
document.getElementById("open-release")?.addEventListener("click", () => {
  void window.knobbDiscordCompanion.openRelease();
});
document.getElementById("open-repo")?.addEventListener("click", () => {
  void window.knobbDiscordCompanion.openRepo();
});
document.getElementById("open-config")?.addEventListener("click", () => {
  void window.knobbDiscordCompanion.openConfigDirectory();
});
checkUpdatesButton?.addEventListener("click", () => {
  void window.knobbDiscordCompanion.checkForUpdates();
});
installUpdateButton?.addEventListener("click", () => {
  void window.knobbDiscordCompanion.installUpdate();
});

renderStatus(await window.knobbDiscordCompanion.getStatus());
renderUpdateStatus(await window.knobbDiscordCompanion.getUpdateStatus());
window.knobbDiscordCompanion.onStatus(renderStatus);
window.knobbDiscordCompanion.onUpdateStatus(renderUpdateStatus);
