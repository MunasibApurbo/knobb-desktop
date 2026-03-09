import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildMacUpdateFeed, compareReleaseVersions, inferMacUpdateZipUrl, readJson } from "./mac-update-feed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const electronDist = path.join(projectRoot, "node_modules", "electron", "dist");
const sourceAppBundle = path.join(electronDist, "Electron.app");
const outputRoot = path.join(projectRoot, "release", "macos");
const bundleName = "Knobb Desktop.app";
const outputAppBundle = path.join(outputRoot, bundleName);
const resourcesAppDir = path.join(outputAppBundle, "Contents", "Resources", "app");
const plistPath = path.join(outputAppBundle, "Contents", "Info.plist");
const binaryDir = path.join(outputAppBundle, "Contents", "MacOS");
const oldExecutablePath = path.join(binaryDir, "Electron");
const newExecutableName = "Knobb Desktop";
const newExecutablePath = path.join(binaryDir, newExecutableName);
const iconSetDir = path.join(outputRoot, "knobb.iconset");
const icnsPath = path.join(outputRoot, "knobb.icns");
const zipPath = path.join(outputRoot, "Knobb-Desktop-macOS.zip");
const dmgStageDir = path.join(outputRoot, "dmg-stage");
const dmgPath = path.join(outputRoot, "Knobb-Desktop-macOS.dmg");
const brand1024 = path.join(projectRoot, "public", "brand", "logo-k-black-bg-1024.png");
const brand512 = path.join(projectRoot, "public", "brand", "logo-k-black-bg-512.png");
const brand256 = path.join(projectRoot, "public", "brand", "logo-k-black-bg-256.png");
const sourceUpdateConfigPath = path.join(projectRoot, "desktop", "knobb", "app-update.json");
const releaseFeedPath = path.join(outputRoot, "releases.json");
const codesignIdentity = String(process.env.KNOBB_CODESIGN_IDENTITY || "").trim();
const notaryProfile = String(process.env.KNOBB_NOTARY_PROFILE || "").trim();
const updateFeedUrl = String(process.env.KNOBB_DESKTOP_UPDATE_FEED_URL || "").trim();
const updateZipUrl = String(process.env.KNOBB_DESKTOP_UPDATE_ZIP_URL || "").trim();
const updateCheckIntervalHours = Math.max(
  1,
  Number.parseInt(process.env.KNOBB_DESKTOP_UPDATE_INTERVAL_HOURS || "4", 10) || 4,
);
const skipDmg = process.env.KNOBB_DESKTOP_SKIP_DMG === "1";
const failOnDmgError = process.env.KNOBB_DESKTOP_FAIL_ON_DMG_ERROR === "1";

function run(command, args) {
  execFileSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureBuild() {
  run("npm", ["run", "build"]);
  await fs.access(path.join(projectRoot, "dist", "index.html"));
}

async function readProjectPackage() {
  const source = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
  return JSON.parse(source);
}

async function readSourceUpdateConfig() {
  const source = await fs.readFile(sourceUpdateConfigPath, "utf8");
  return JSON.parse(source);
}

async function warnIfVersionWillNotAutoUpdate(appVersion) {
  const existingFeed = await readJson(releaseFeedPath, null);
  const currentRelease = String(existingFeed?.currentRelease || "").trim();
  if (!currentRelease) {
    return;
  }

  if (compareReleaseVersions(appVersion, currentRelease) <= 0) {
    console.warn(
      `Desktop auto-update warning: package.json version ${appVersion} is not newer than the current feed release ${currentRelease}.`,
    );
    console.warn(
      "This build can be packaged and installed manually, but existing apps will not auto-update to it until you bump package.json to a newer semantic version.",
    );
  }
}

async function removeIfPresent(targetPath) {
  if (await exists(targetPath)) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

async function copyAppSource() {
  await removeIfPresent(outputAppBundle);
  await fs.mkdir(outputRoot, { recursive: true });
  run("ditto", [sourceAppBundle, outputAppBundle]);
}

async function writeRuntimePackage(appVersion) {
  await fs.mkdir(resourcesAppDir, { recursive: true });
  await fs.writeFile(
    path.join(resourcesAppDir, "package.json"),
    JSON.stringify({
      name: "knobb-desktop",
      productName: "Knobb Desktop",
      version: appVersion,
      type: "module",
      main: "desktop/knobb/main.mjs",
    }, null, 2),
  );
}

async function writeUpdateConfig(appVersion) {
  const sourceUpdateConfig = await readSourceUpdateConfig();
  const resolvedFeedUrl = updateFeedUrl || sourceUpdateConfig.feedURL || null;
  const updateConfigPath = path.join(resourcesAppDir, "desktop", "knobb", "app-update.json");
  await fs.mkdir(path.dirname(updateConfigPath), { recursive: true });
  await fs.writeFile(
    updateConfigPath,
    JSON.stringify({
      version: appVersion,
      feedURL: resolvedFeedUrl,
      checkOnLaunch: sourceUpdateConfig.checkOnLaunch !== false,
      checkIntervalHours: sourceUpdateConfig.checkIntervalHours
        ? updateCheckIntervalHours || sourceUpdateConfig.checkIntervalHours
        : updateCheckIntervalHours,
    }, null, 2),
  );

  return {
    feedURL: resolvedFeedUrl,
  };
}

async function copyRuntimeFiles() {
  const targets = [
    ["desktop/knobb", "desktop/knobb"],
    ["scripts/discord-presence-bridge-core.mjs", "scripts/discord-presence-bridge-core.mjs"],
    ["dist", "dist"],
    ["public/brand", "public/brand"],
    ["discord-presence.bridge.example.json", "discord-presence.bridge.example.json"],
  ];

  for (const [sourceRelative, destinationRelative] of targets) {
    const sourcePath = path.join(projectRoot, sourceRelative);
    const destinationPath = path.join(resourcesAppDir, destinationRelative);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.cp(sourcePath, destinationPath, {
      recursive: true,
      force: true,
    });
  }
}

async function buildIcns() {
  await removeIfPresent(iconSetDir);
  await removeIfPresent(icnsPath);
  await fs.mkdir(iconSetDir, { recursive: true });

  const conversions = [
    { source: brand1024, name: "icon_512x512@2x.png", size: 1024 },
    { source: brand512, name: "icon_512x512.png", size: 512 },
    { source: brand512, name: "icon_256x256@2x.png", size: 512 },
    { source: brand256, name: "icon_256x256.png", size: 256 },
    { source: brand256, name: "icon_128x128@2x.png", size: 256 },
    { source: brand256, name: "icon_128x128.png", size: 128 },
    { source: brand256, name: "icon_32x32@2x.png", size: 64 },
    { source: brand256, name: "icon_32x32.png", size: 32 },
    { source: brand256, name: "icon_16x16@2x.png", size: 32 },
    { source: brand256, name: "icon_16x16.png", size: 16 },
  ];

  for (const conversion of conversions) {
    run("sips", [
      "-z",
      String(conversion.size),
      String(conversion.size),
      conversion.source,
      "--out",
      path.join(iconSetDir, conversion.name),
    ]);
  }

  try {
    run("iconutil", ["-c", "icns", iconSetDir, "-o", icnsPath]);
    return true;
  } catch (error) {
    console.warn("Falling back to Electron default bundle icon because iconutil failed.");
    console.warn(error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function updatePlist(hasCustomIcon, appVersion) {
  run("plutil", ["-replace", "CFBundleDisplayName", "-string", "Knobb Desktop", plistPath]);
  run("plutil", ["-replace", "CFBundleExecutable", "-string", newExecutableName, plistPath]);
  if (hasCustomIcon) {
    run("plutil", ["-replace", "CFBundleIconFile", "-string", "knobb.icns", plistPath]);
  }
  run("plutil", ["-replace", "CFBundleIdentifier", "-string", "fm.knobb.desktop", plistPath]);
  run("plutil", ["-replace", "CFBundleName", "-string", "Knobb Desktop", plistPath]);
  run("plutil", ["-replace", "CFBundleShortVersionString", "-string", appVersion, plistPath]);
  run("plutil", ["-replace", "CFBundleVersion", "-string", appVersion, plistPath]);
}

async function renameExecutable() {
  await fs.rename(oldExecutablePath, newExecutablePath);
}

async function installIcon() {
  await fs.copyFile(icnsPath, path.join(outputAppBundle, "Contents", "Resources", "knobb.icns"));
}

async function zipBundle() {
  await removeIfPresent(zipPath);
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", outputAppBundle, zipPath]);
}

function getSignIdentity() {
  return codesignIdentity || "-";
}

function getCodesignArgs() {
  const args = [
    "--force",
    "--deep",
    "--sign",
    getSignIdentity(),
  ];

  if (codesignIdentity) {
    args.push("--options", "runtime");
  }

  return args;
}

function getCodesignTargets() {
  return [
    path.join(outputAppBundle, "Contents", "Frameworks", "Mantle.framework"),
    path.join(outputAppBundle, "Contents", "Frameworks", "ReactiveObjC.framework"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Squirrel.framework"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Framework.framework"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper.app"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper (GPU).app"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper (Plugin).app"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper (Renderer).app"),
    outputAppBundle,
  ];
}

async function stripSignatures() {
  const signatureArtifacts = [
    path.join(outputAppBundle, "Contents", "_CodeSignature"),
    path.join(outputAppBundle, "Contents", "CodeResources"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper.app", "Contents", "_CodeSignature"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper (GPU).app", "Contents", "_CodeSignature"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper (Plugin).app", "Contents", "_CodeSignature"),
    path.join(outputAppBundle, "Contents", "Frameworks", "Electron Helper (Renderer).app", "Contents", "_CodeSignature"),
  ];

  for (const artifact of signatureArtifacts) {
    await removeIfPresent(artifact);
  }

  for (const target of [...getCodesignTargets()].reverse()) {
    try {
      run("codesign", ["--remove-signature", target]);
    } catch {
      // Some targets may already be unsigned after packaging changes.
    }
  }
}

async function signBundle() {
  await stripSignatures();

  for (const target of getCodesignTargets()) {
    run("codesign", [...getCodesignArgs(), target]);
  }

  return Boolean(codesignIdentity);
}

async function createDmg() {
  await removeIfPresent(dmgStageDir);
  await removeIfPresent(dmgPath);
  await fs.mkdir(dmgStageDir, { recursive: true });
  run("ditto", [outputAppBundle, path.join(dmgStageDir, bundleName)]);
  await fs.symlink("/Applications", path.join(dmgStageDir, "Applications"));

  run("hdiutil", [
    "create",
    "-volname",
    "Knobb Desktop",
    "-srcfolder",
    dmgStageDir,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);

  return dmgPath;
}

async function notarizeIfConfigured(hasDmg) {
  if (!codesignIdentity || !notaryProfile) {
    return false;
  }

  if (!hasDmg) {
    console.warn("Skipped notarization because the DMG artifact is unavailable.");
    return false;
  }

  run("xcrun", [
    "notarytool",
    "submit",
    dmgPath,
    "--keychain-profile",
    notaryProfile,
    "--wait",
  ]);
  run("xcrun", ["stapler", "staple", outputAppBundle]);
  run("xcrun", ["stapler", "staple", dmgPath]);

  return true;
}

async function maybeWriteUpdateFeed(appVersion, embeddedFeedUrl) {
  const resolvedFeedUrl = embeddedFeedUrl || null;
  const resolvedZipUrl = updateZipUrl || inferMacUpdateZipUrl(resolvedFeedUrl);

  if (!resolvedFeedUrl || !resolvedZipUrl) {
    return null;
  }

  const feedOutputPath = path.join(outputRoot, "releases.json");
  await buildMacUpdateFeed({
    appVersion,
    notes: `Knobb Desktop ${appVersion}`,
    outputPath: feedOutputPath,
    pubDate: new Date().toISOString(),
    zipUrl: resolvedZipUrl,
  });

  return {
    feedOutputPath,
    zipUrl: resolvedZipUrl,
  };
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("desktop:package currently supports macOS only.");
  }

  const projectPackage = await readProjectPackage();
  const appVersion = String(projectPackage.version || "").trim() || "0.0.0";
  await warnIfVersionWillNotAutoUpdate(appVersion);

  await ensureBuild();
  await copyAppSource();
  await writeRuntimePackage(appVersion);
  await copyRuntimeFiles();
  const updateConfig = await writeUpdateConfig(appVersion);
  const hasCustomIcon = await buildIcns();
  await updatePlist(hasCustomIcon, appVersion);
  await renameExecutable();
  if (hasCustomIcon) {
    await installIcon();
  }
  const signed = await signBundle();
  await zipBundle();
  const updateFeed = await maybeWriteUpdateFeed(appVersion, updateConfig.feedURL);

  let dmgCreated = false;
  if (!skipDmg) {
    try {
      await createDmg();
      dmgCreated = true;
    } catch (error) {
      console.warn("Failed to create the DMG artifact. Keeping the app bundle and ZIP release artifacts.");
      console.warn(error instanceof Error ? error.message : String(error));
      if (failOnDmgError) {
        throw error;
      }
    }
  }

  const notarized = await notarizeIfConfigured(dmgCreated);

  console.log(`\nPackaged ${outputAppBundle}`);
  console.log(`Created ${zipPath}`);
  if (dmgCreated) {
    console.log(`Created ${dmgPath}`);
  } else if (skipDmg) {
    console.log("Skipped DMG creation (set KNOBB_DESKTOP_SKIP_DMG=0 or unset it to build a DMG).");
  } else {
    console.log("Skipped DMG artifact after a packaging error. The app bundle and ZIP are still ready.");
  }
  console.log(`Version: ${appVersion}`);
  if (signed) {
    console.log(`Signed with identity: ${codesignIdentity}`);
  } else {
    console.log("Skipped code signing (set KNOBB_CODESIGN_IDENTITY to enable).");
  }
  if (updateConfig.feedURL) {
    console.log(`Embedded update feed: ${updateConfig.feedURL}`);
  } else {
    console.log("Skipped embedded update feed (set KNOBB_DESKTOP_UPDATE_FEED_URL to enable in-app update checks).");
  }
  if (updateFeed) {
    console.log(`Created ${updateFeed.feedOutputPath}`);
    console.log(`Update ZIP URL: ${updateFeed.zipUrl}`);
  } else {
    console.log("Skipped update feed generation (configure a feed URL ending in /releases.json or set KNOBB_DESKTOP_UPDATE_ZIP_URL).");
  }
  if (notarized) {
    console.log(`Notarized with profile: ${notaryProfile}`);
  } else {
    console.log("Skipped notarization (set KNOBB_CODESIGN_IDENTITY and KNOBB_NOTARY_PROFILE to enable).");
  }
}

void main().catch((error) => {
  console.error("Failed to package Knobb Desktop", error);
  process.exit(1);
});
