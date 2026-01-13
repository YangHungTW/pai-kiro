#!/usr/bin/env bun
/**
 * Sync script for pai-kiro ↔ ~/.kiro
 *
 * Usage:
 *   bun run scripts/sync.ts push    # Sync settings (copy) + ensure symlinks
 *   bun run scripts/sync.ts setup   # Full setup including memory/observability
 *   bun run scripts/sync.ts status  # Show current status
 */

import { $ } from "bun";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, lstatSync } from "fs";
import { join, extname } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const PAI_KIRO = join(PROJECT_ROOT, "pai-kiro");
const HOME_KIRO = join(process.env.HOME!, ".kiro");

// Directories to symlink (config/code - changes apply immediately)
const LINK_DIRS = ["steering", "agents", "hooks", "skills"];

// Directory to copy with env substitution
const COPY_DIR = "settings";

// Directories to initialize only during setup (runtime data)
const SETUP_DIRS = ["memory", "observability"];

// File extensions that support variable substitution
const TEXT_EXTENSIONS = [".md", ".json", ".ts", ".yaml", ".yml", ".txt"];

// Load .env file and return env object
function loadEnv(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    env[key] = value;
  }

  return env;
}

// Replace ${VAR} placeholders with actual values
function replacePlaceholders(content: string, env: Record<string, string>): string {
  return content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return env[varName] || match;
  });
}

// Recursively process all text files in a directory and replace placeholders
function processDirectory(dir: string, env: Record<string, string>): number {
  let count = 0;

  if (!existsSync(dir)) return count;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      count += processDirectory(fullPath, env);
    } else if (stat.isFile() && TEXT_EXTENSIONS.includes(extname(entry))) {
      const content = readFileSync(fullPath, "utf-8");
      const processed = replacePlaceholders(content, env);
      if (content !== processed) {
        writeFileSync(fullPath, processed);
        count++;
      }
    }
  }

  return count;
}

// Check if path is a symlink
function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

async function push() {
  console.log("📤 Syncing pai-kiro → ~/.kiro\n");

  const envPath = join(PAI_KIRO, "settings", ".env");
  const env = loadEnv(envPath);

  // Warn if .env is missing
  if (!existsSync(envPath)) {
    console.log(`⚠️  Warning: ${envPath} not found`);
    console.log(`   Copy .env.example to .env and fill in your values\n`);
  }

  // Ensure ~/.kiro exists
  if (!existsSync(HOME_KIRO)) {
    mkdirSync(HOME_KIRO, { recursive: true });
  }

  // Ensure symlinks for config directories
  for (const dir of LINK_DIRS) {
    const src = join(PAI_KIRO, dir);
    const dest = join(HOME_KIRO, dir);

    if (!existsSync(src)) {
      console.log(`⚠️  Skipping ${dir} (not found in pai-kiro)`);
      continue;
    }

    if (isSymlink(dest)) {
      console.log(`🔗 ${dir}/ - symlinked`);
    } else if (existsSync(dest)) {
      console.log(`⚠️  ${dir}/ exists as directory. Run 'bun run scripts/sync.ts setup' to convert.`);
    } else {
      console.log(`🔗 Creating symlink: ${dir}/`);
      await $`ln -s ${src} ${dest}`.quiet();
    }
  }

  // Copy settings with env substitution
  const settingsSrc = join(PAI_KIRO, COPY_DIR);
  const settingsDest = join(HOME_KIRO, COPY_DIR);

  if (existsSync(settingsSrc)) {
    if (!existsSync(settingsDest)) {
      mkdirSync(settingsDest, { recursive: true });
    }

    console.log(`📁 Copying ${COPY_DIR}/ (with env substitution)`);
    await $`rsync -av --delete ${settingsSrc}/ ${settingsDest}/`.quiet();

    // Replace placeholders
    const processed = processDirectory(settingsDest, env);
    if (processed > 0) {
      console.log(`   ✨ Replaced variables in ${processed} file(s)`);
    }
  }

  console.log("\n✅ Push complete!");
}

async function setup() {
  console.log("🔧 Setting up ~/.kiro\n");

  const envPath = join(PAI_KIRO, "settings", ".env");
  const env = loadEnv(envPath);

  if (!existsSync(envPath)) {
    console.log(`⚠️  Warning: ${envPath} not found`);
    console.log(`   Copy .env.example to .env and fill in your values\n`);
  }

  // Ensure ~/.kiro exists
  if (!existsSync(HOME_KIRO)) {
    mkdirSync(HOME_KIRO, { recursive: true });
  }

  // Create symlinks for config directories
  for (const dir of LINK_DIRS) {
    const src = join(PAI_KIRO, dir);
    const dest = join(HOME_KIRO, dir);

    if (!existsSync(src)) {
      console.log(`⚠️  Skipping ${dir} (not found in pai-kiro)`);
      continue;
    }

    if (isSymlink(dest)) {
      console.log(`🔗 ${dir}/ - already symlinked`);
    } else {
      if (existsSync(dest)) {
        console.log(`🗑️  Removing existing ${dir}/`);
        await $`rm -rf ${dest}`.quiet();
      }
      console.log(`🔗 Creating symlink: ${dir}/`);
      await $`ln -s ${src} ${dest}`.quiet();
    }
  }

  // Copy settings with env substitution
  const settingsSrc = join(PAI_KIRO, COPY_DIR);
  const settingsDest = join(HOME_KIRO, COPY_DIR);

  if (existsSync(settingsSrc)) {
    if (!existsSync(settingsDest)) {
      mkdirSync(settingsDest, { recursive: true });
    }

    console.log(`📁 Copying ${COPY_DIR}/ (with env substitution)`);
    await $`rsync -av --delete ${settingsSrc}/ ${settingsDest}/`.quiet();

    const processed = processDirectory(settingsDest, env);
    if (processed > 0) {
      console.log(`   ✨ Replaced variables in ${processed} file(s)`);
    }
  }

  // Initialize runtime directories (copy once, don't overwrite)
  for (const dir of SETUP_DIRS) {
    const src = join(PAI_KIRO, dir);
    const dest = join(HOME_KIRO, dir);

    if (!existsSync(src)) {
      console.log(`⚠️  Skipping ${dir} (not found in pai-kiro)`);
      continue;
    }

    if (existsSync(dest)) {
      console.log(`📂 ${dir}/ - already exists (preserved)`);
    } else {
      console.log(`📂 Initializing ${dir}/`);
      await $`cp -r ${src} ${dest}`.quiet();
    }
  }

  console.log("\n✅ Setup complete!");
}

async function status() {
  console.log("🔍 Checking ~/.kiro status\n");

  // Check symlink directories
  console.log("Symlinked directories:");
  for (const dir of LINK_DIRS) {
    const dest = join(HOME_KIRO, dir);

    if (!existsSync(dest)) {
      console.log(`  ❌ ${dir}/ - missing`);
    } else if (isSymlink(dest)) {
      console.log(`  ✅ ${dir}/ - symlinked`);
    } else {
      console.log(`  ⚠️  ${dir}/ - is directory (should be symlink)`);
    }
  }

  // Check settings
  console.log("\nCopied directories:");
  const settingsDest = join(HOME_KIRO, COPY_DIR);
  if (existsSync(settingsDest)) {
    console.log(`  ✅ ${COPY_DIR}/ - exists`);
  } else {
    console.log(`  ❌ ${COPY_DIR}/ - missing`);
  }

  // Check runtime directories
  console.log("\nRuntime directories:");
  for (const dir of SETUP_DIRS) {
    const dest = join(HOME_KIRO, dir);

    if (existsSync(dest)) {
      console.log(`  ✅ ${dir}/ - exists`);
    } else {
      console.log(`  ❌ ${dir}/ - missing (run setup)`);
    }
  }
}

// Main
const command = process.argv[2];

switch (command) {
  case "push":
    await push();
    break;
  case "setup":
    await setup();
    break;
  case "status":
    await status();
    break;
  default:
    console.log(`
Usage: bun run scripts/sync.ts <command>

Commands:
  push    Sync settings (copy with env substitution) + ensure symlinks
  setup   Full setup: create symlinks + copy settings + init runtime dirs
  status  Show current ~/.kiro status
`);
}
