const bridgeDot = document.getElementById("bridge-dot");
const bridgeLabel = document.getElementById("bridge-label");
const discordDot = document.getElementById("discord-dot");
const discordLabel = document.getElementById("discord-label");
const clientId = document.getElementById("client-id");
const bridgePort = document.getElementById("bridge-port");
const lastError = document.getElementById("last-error");
const activityPanel = document.getElementById("activity-panel");
const activityTitle = document.getElementById("activity-title");
const activityArtist = document.getElementById("activity-artist");
const activityState = document.getElementById("activity-state");

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

document.getElementById("open-knobb")?.addEventListener("click", () => {
  void window.knobbDiscordCompanion.openKnobb();
});

renderStatus(await window.knobbDiscordCompanion.getStatus());
window.knobbDiscordCompanion.onStatus(renderStatus);
