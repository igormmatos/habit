import { mkdir, copyFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const srcDir = join(root, "legacy");
const outDir = join(root, "dist", "legacy");

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
        return;
      }
      if (entry.isFile()) {
        await copyFile(srcPath, destPath);
      }
    })
  );
}

async function run() {
  try {
    const legacyStats = await stat(srcDir);
    if (!legacyStats.isDirectory()) {
      console.warn("legacy directory not found, skipping copy.");
      return;
    }
  } catch {
    console.warn("legacy directory not found, skipping copy.");
    return;
  }

  await copyDir(srcDir, outDir);
  console.log("Copied legacy files to dist/legacy.");
}

run();
