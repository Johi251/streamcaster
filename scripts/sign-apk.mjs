/**
 * Signs the CI-built APK with the release keystore and verifies the result.
 *
 * The GitHub Actions build produces an UNSIGNED release APK (the repo secrets
 * are not set on the runner), so signing happens here, on the machine that
 * holds the keystore. The same keystore as every published release is used, so
 * the new APK installs as an update over the old one.
 *
 * Usage:
 *   node scripts/sign-apk.mjs <input.apk> [output.apk]
 *
 * Both the keystore path and the passwords come from
 * airplay-receiver/.secrets/signing.properties (fallback: local.properties).
 * Nothing secret is ever printed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const receiverDir = join(root, "airplay-receiver");

function readProps(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const props = {
  ...readProps(join(receiverDir, "local.properties")),
  ...readProps(join(receiverDir, ".secrets", "signing.properties")),
};

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/sign-apk.mjs <input.apk> [output.apk]");
  process.exit(1);
}
const output = process.argv[3] || join(receiverDir, "dist", "streamcaster-receiver.apk");

if (!existsSync(input)) {
  console.error("input not found: " + input);
  process.exit(1);
}

// --- locate build-tools (apksigner + zipalign) -----------------------------
function findBuildTools() {
  const candidates = [
    join(receiverDir, ".toolchain", "android-sdk", "build-tools"),
    join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "build-tools"),
    "C:/Users/johan/scb-sdk/build-tools",
  ];
  for (const base of candidates) {
    if (!base || !existsSync(base)) continue;
    const versions = readDirSorted(base);
    const newest = versions[versions.length - 1];
    if (!newest) continue;
    const dir = join(base, newest);
    if (existsSync(join(dir, "lib", "apksigner.jar"))) return dir;
  }
  throw new Error("no Android build-tools with apksigner found");
}

function readDirSorted(dir) {
  return readdirSync(dir).sort();
}

// apksigner and zipalign: use the real binaries, not the .bat wrappers.
// Node 22 refuses to spawn .bat files without a shell, and the wrappers add
// nothing. apksigner is a plain jar, so it runs with `java -jar`.
const isWindows = process.platform === "win32";

let bt;
try {
  bt = findBuildTools();
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}

const tool = (name) => (isWindows ? join(bt, name + ".exe") : join(bt, name));
const apksignerJar = join(bt, "lib", "apksigner.jar");
const apksignerCmd = "java";
const apksignerArgs = ["-jar", apksignerJar];

console.log("build-tools: " + bt);

// --- sign ------------------------------------------------------------------
const storeFile = props.storeFile;
if (!storeFile) {
  console.error("no storeFile in local.properties / .secrets/signing.properties");
  process.exit(1);
}
const ks = storeFile.startsWith(".") ? join(receiverDir, storeFile) : join(receiverDir, storeFile);
if (!existsSync(ks)) {
  console.error("keystore not found: " + ks);
  process.exit(1);
}

// zipalign first: apksigner keeps the existing alignment, but a freshly
// aligned input keeps the v2/v3 signature blocks valid on every device.
const aligned = output + ".aligned";
execFileSync(tool("zipalign"), ["-p", "-f", "4", input, aligned], { stdio: "inherit" });

const args = [
  ...apksignerArgs,
  "sign",
  "--ks", ks,
  "--ks-key-alias", props.keyAlias || "streamcaster",
  "--ks-pass", "pass:" + props.storePassword,
  "--key-pass", "pass:" + props.keyPassword,
  "--v1-signing-enabled", "true",
  "--v2-signing-enabled", "true",
  "--v3-signing-enabled", "true",
  "--v4-signing-enabled", "false",
  "--min-sdk-version", "22",
  "--out", output,
  aligned,
];
execFileSync(apksignerCmd, args, { stdio: "inherit" });

// --- verify ----------------------------------------------------------------
console.log("\n--- verification ---");
const out = execFileSync(apksignerCmd, [...apksignerArgs, "verify", "--verbose", "--print-certs", output], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
console.log(out.split(/\r?\n/).filter((l) => /scheme|Number of signers|Signer #1 certificate SHA-256/.test(l)).join("\n"));

const size = statSync(output).size;
console.log("\nsigned: " + output + "  (" + size.toLocaleString("en-US") + " bytes)");
