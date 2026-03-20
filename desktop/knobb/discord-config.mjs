export const DISCORD_CLIENT_ID_PLACEHOLDER = "YOUR_DISCORD_APPLICATION_CLIENT_ID";

export function hasConfiguredDiscordClientId(configOrClientId) {
  const rawClientId = typeof configOrClientId === "object" && configOrClientId !== null
    ? configOrClientId.clientId
    : configOrClientId;
  const normalizedClientId = String(rawClientId || "").trim();

  return normalizedClientId.length > 0 && normalizedClientId !== DISCORD_CLIENT_ID_PLACEHOLDER;
}

export function shouldSeedDesktopBridgeConfig(existingConfig, bundledConfig) {
  return hasConfiguredDiscordClientId(bundledConfig) && !hasConfiguredDiscordClientId(existingConfig);
}

export function resolveDesktopDiscordConfig(bundledConfig, userConfig) {
  const resolvedBundledConfig = bundledConfig && typeof bundledConfig === "object" ? bundledConfig : {};
  const resolvedUserConfig = userConfig && typeof userConfig === "object" ? userConfig : {};
  const preferUserConfig = hasConfiguredDiscordClientId(resolvedUserConfig);

  return {
    ...resolvedBundledConfig,
    ...(preferUserConfig ? resolvedUserConfig : {}),
    clientId: preferUserConfig
      ? String(resolvedUserConfig.clientId || "").trim()
      : String(resolvedBundledConfig.clientId || "").trim(),
    assets: {
      ...(resolvedBundledConfig.assets || {}),
      ...(preferUserConfig ? (resolvedUserConfig.assets || {}) : {}),
    },
  };
}
