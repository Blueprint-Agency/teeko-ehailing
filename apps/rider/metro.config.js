const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Metro defaults to (cores - 1) workers. Running rider + driver at once would
// spawn ~2x that and oversubscribe the CPU, making reloads crawl. Cap it so both
// dev servers can coexist alongside the emulators and backend.
config.maxWorkers = 4;

// Watch only the shared packages we consume plus the pnpm store, not the whole
// monorepo. Watching monorepoRoot pulls in apps/backend, apps/web, apps/admin and
// the sibling Expo app, which makes running rider + driver at once very slow.
config.watchFolders = [
  path.resolve(monorepoRoot, "packages"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = true;

// Separator-agnostic so these also match on Windows.
config.resolver.blockList = [
  /node_modules[\\/].*[\\/]android[\\/]build[\\/].*/,
  /node_modules[\\/].*[\\/]\.gradle[\\/].*/,
  /[\\/]android[\\/]build[\\/].*/,
  /[\\/]android[\\/]\.gradle[\\/].*/,
  /[\\/]ios[\\/](build|Pods)[\\/].*/,
  /[\\/]\.expo[\\/].*/,
  /[\\/]\.next[\\/].*/,
  /[\\/]\.turbo[\\/].*/,
];

module.exports = withNativeWind(config, { input: "./global.css" });
