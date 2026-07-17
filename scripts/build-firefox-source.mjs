import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedVersion = "1.0.2";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const buildRoot = path.join(projectRoot, "build");
const defaultOutputRoot = path.join(buildRoot, "firefox");

function parseOutputRoot() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    return { outputRoot: defaultOutputRoot, resetOutput: true };
  }
  if (args.length !== 2 || args[0] !== "--output" || !args[1]) {
    throw new Error("Usage: node scripts/build-firefox-source.mjs [--output <empty-directory>]");
  }
  return { outputRoot: path.resolve(args[1]), resetOutput: false };
}

const { outputRoot, resetOutput } = parseOutputRoot();

function resolveInside(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe or empty package path: ${relativePath}`);
  }
  return resolvedPath;
}

async function readJson(relativePath) {
  const filePath = resolveInside(projectRoot, relativePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertFile(filePath, label) {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`Required ${label} is missing: ${filePath}`);
  }
}

const packageFiles = await readJson("scripts/package-files.json");
const runtimeFiles = packageFiles.runtimeFiles;
const requiredLocales = packageFiles.requiredLocales;
if (!Array.isArray(runtimeFiles) || !Array.isArray(requiredLocales)) {
  throw new Error("scripts/package-files.json contains invalid package lists.");
}

const localeFiles = requiredLocales.map((locale) => `_locales/${locale}/messages.json`);
const copiedFiles = [...runtimeFiles, ...localeFiles];
if (new Set(copiedFiles).size !== copiedFiles.length) {
  throw new Error("scripts/package-files.json contains duplicate package paths.");
}

const manifest = await readJson("manifest.json");
const firefoxOverlay = await readJson("manifest.firefox.json");
if (manifest.version !== expectedVersion) {
  throw new Error(`manifest.json version must be ${expectedVersion}.`);
}
if (Object.hasOwn(manifest, "browser_specific_settings")) {
  throw new Error("The shared manifest must not contain Firefox-only settings.");
}
if (
  Object.keys(firefoxOverlay).length !== 1 ||
  !Object.hasOwn(firefoxOverlay, "browser_specific_settings")
) {
  throw new Error("manifest.firefox.json must contain only browser_specific_settings.");
}

const gecko = firefoxOverlay.browser_specific_settings?.gecko;
if (gecko?.id !== "all-chats-sidebar-for-grok@communism420.github.io") {
  throw new Error("The Firefox Add-on ID is invalid.");
}
if (gecko?.strict_min_version !== "142.0") {
  throw new Error("Firefox strict_min_version must be 142.0.");
}

if (resetOutput) {
  const outputRelative = path.relative(buildRoot, outputRoot);
  if (!outputRelative || outputRelative.startsWith("..") || path.isAbsolute(outputRelative)) {
    throw new Error("Refusing to reset a directory outside the project build directory.");
  }
  await rm(outputRoot, { recursive: true, force: true });
} else {
  const outputStat = await stat(outputRoot).catch(() => null);
  if (outputStat && !outputStat.isDirectory()) {
    throw new Error(`The requested output path is not a directory: ${outputRoot}`);
  }
  if (outputStat && (await readdir(outputRoot)).length > 0) {
    throw new Error(`The requested output directory must be empty: ${outputRoot}`);
  }
}

await mkdir(outputRoot, { recursive: true });
for (const relativePath of copiedFiles) {
  const sourcePath = resolveInside(projectRoot, relativePath);
  const destinationPath = resolveInside(outputRoot, relativePath);
  await assertFile(sourcePath, "source file");
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

const firefoxManifest = {
  ...manifest,
  browser_specific_settings: firefoxOverlay.browser_specific_settings
};
const manifestText = `${JSON.stringify(firefoxManifest, null, 2).replaceAll("\n", "\r\n")}\r\n`;
await writeFile(path.join(outputRoot, "manifest.json"), manifestText, "utf8");

console.log(`Built Firefox review directory: ${outputRoot}`);
