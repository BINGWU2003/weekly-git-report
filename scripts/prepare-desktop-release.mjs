import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const releaseDirectory = resolve(repositoryRoot, process.argv[2] ?? "apps/desktop/release");
const outputDirectory = resolve(repositoryRoot, ".release");
const desktopPackage = JSON.parse(
  await readFile(resolve(repositoryRoot, "apps/desktop/package.json"), "utf8"),
);
const version = desktopPackage.version;
const installerName = `Weekly-Git-Report-Setup-${version}-x64.exe`;
const expectedAssets = [installerName, `${installerName}.blockmap`, "latest.yml"];
const availableFiles = new Set(await readdir(releaseDirectory));

for (const asset of expectedAssets) {
  if (!availableFiles.has(asset)) {
    throw new Error(`缺少 Desktop Release 资产：${asset}`);
  }
}

const latestYaml = await readFile(join(releaseDirectory, "latest.yml"), "utf8");
const feedVersion = readYamlScalar(latestYaml, "version");
const feedPath = readYamlScalar(latestYaml, "path");
if (feedVersion !== version) {
  throw new Error(`latest.yml 版本 ${feedVersion ?? "缺失"} 与 package.json ${version} 不一致。`);
}
if (feedPath !== installerName) {
  throw new Error(`latest.yml 安装包 ${feedPath ?? "缺失"} 与预期 ${installerName} 不一致。`);
}

const changelog = await readFile(resolve(repositoryRoot, "apps/desktop/CHANGELOG.md"), "utf8");
const releaseNotes = extractReleaseNotes(changelog, version);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  join(outputDirectory, "desktop-release-notes.md"),
  `${releaseNotes.trim()}\n`,
  "utf8",
);

const checksumLines = [];
for (const asset of expectedAssets) {
  const content = await readFile(join(releaseDirectory, asset));
  checksumLines.push(`${createHash("sha256").update(content).digest("hex")}  ${basename(asset)}`);
}
await writeFile(join(outputDirectory, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ version, assets: expectedAssets, releaseNotes: releaseNotes.trim() }));

function readYamlScalar(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*["']?([^\\r\\n"']+)["']?\\s*$`, "m"));
  return match?.[1]?.trim();
}

function extractReleaseNotes(content, targetVersion) {
  const escapedVersion = targetVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^##\\s+${escapedVersion}\\s*\\r?$`, "m");
  const match = heading.exec(content);
  if (!match || match.index === undefined) {
    throw new Error(`apps/desktop/CHANGELOG.md 中缺少 ${targetVersion} 的版本说明。`);
  }
  const remaining = content.slice(match.index + match[0].length).replace(/^\\r?\\n/, "");
  const nextHeading = remaining.search(/^##\\s+/m);
  const notes = (nextHeading < 0 ? remaining : remaining.slice(0, nextHeading)).trim();
  if (!notes) throw new Error(`${targetVersion} 的版本说明不能为空。`);
  return notes;
}
