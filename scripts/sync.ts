#!/usr/bin/env bun
/**
 * Sync script for pai-kiro ↔ ~/.kiro
 *
 * Usage:
 *   bun run scripts/sync.ts push    # Push pai-kiro → ~/.kiro
 *   bun run scripts/sync.ts pull    # Pull ~/.kiro → pai-kiro
 *   bun run scripts/sync.ts status  # Show diff status
 */

import { $ } from "bun";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const PAI_KIRO = join(PROJECT_ROOT, "pai-kiro");
const HOME_KIRO = join(process.env.HOME!, ".kiro");

// Directories to sync (inside pai-kiro/ → ~/.kiro)
const SYNC_DIRS = ["steering", "agents", "hooks", "skills"];

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

async function push() {
  console.log("📤 Pushing pai-kiro → ~/.kiro\n");

  // Ensure ~/.kiro exists
  if (!existsSync(HOME_KIRO)) {
    mkdirSync(HOME_KIRO, { recursive: true });
  }

  // Sync directories inside pai-kiro/
  for (const dir of SYNC_DIRS) {
    const src = join(PAI_KIRO, dir);
    const dest = join(HOME_KIRO, dir);

    if (!existsSync(src)) {
      console.log(`⚠️  Skipping ${dir} (not found in pai-kiro)`);
      continue;
    }

    console.log(`📁 Syncing ${dir}/`);
    await $`rsync -av --delete ${src}/ ${dest}/`.quiet();
  }

  // Sync MCP settings with env replacement
  const mcpSrc = join(PAI_KIRO, "settings", "mcp.json");
  const mcpDest = join(HOME_KIRO, "settings", "mcp.json");
  const envPath = join(PAI_KIRO, "settings", ".env");

  if (existsSync(mcpSrc)) {
    // Ensure settings directory exists
    const settingsDir = join(HOME_KIRO, "settings");
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }

    const env = loadEnv(envPath);
    const mcpContent = readFileSync(mcpSrc, "utf-8");
    const resolvedContent = replacePlaceholders(mcpContent, env);

    writeFileSync(mcpDest, resolvedContent);
    console.log(`📄 MCP settings synced (with env substitution)`);

    // Warn if .env is missing
    if (!existsSync(envPath)) {
      console.log(`\n⚠️  Warning: ${envPath} not found`);
      console.log(`   Copy .env.example to .env and fill in your values`);
    }
  }

  console.log("\n✅ Push complete!");
}

async function pull() {
  console.log("📥 Pulling ~/.kiro → pai-kiro\n");

  // Pull directories inside pai-kiro/
  for (const dir of SYNC_DIRS) {
    const src = join(HOME_KIRO, dir);
    const dest = join(PAI_KIRO, dir);

    if (!existsSync(src)) {
      console.log(`⚠️  Skipping ${dir} (not found in ~/.kiro)`);
      continue;
    }

    console.log(`📁 Syncing ${dir}/`);
    await $`rsync -av --delete ${src}/ ${dest}/`.quiet();
  }

  console.log("\n⚠️  Note: MCP settings not pulled (contains secrets)");
  console.log("✅ Pull complete!");
}

async function status() {
  console.log("🔍 Checking sync status\n");

  // Check directories inside pai-kiro/
  for (const dir of SYNC_DIRS) {
    const src = join(PAI_KIRO, dir);
    const dest = join(HOME_KIRO, dir);

    if (!existsSync(src) || !existsSync(dest)) {
      console.log(`⚠️  ${dir}/ - missing on one side`);
      continue;
    }

    const result = await $`diff -rq ${src} ${dest} 2>/dev/null || true`.text();
    if (result.trim()) {
      console.log(`📁 ${dir}/ - has differences:`);
      console.log(result.trim().split("\n").map(l => `   ${l}`).join("\n"));
    } else {
      console.log(`✅ ${dir}/ - in sync`);
    }
  }

  // Check MCP settings
  const mcpDest = join(HOME_KIRO, "settings", "mcp.json");
  if (existsSync(mcpDest)) {
    console.log(`✅ settings/mcp.json - exists in ~/.kiro`);
  } else {
    console.log(`⚠️  settings/mcp.json - not found in ~/.kiro`);
  }
}

// Main
const command = process.argv[2];

switch (command) {
  case "push":
    await push();
    break;
  case "pull":
    await pull();
    break;
  case "status":
    await status();
    break;
  default:
    console.log(`
Usage: bun run scripts/sync.ts <command>

Commands:
  push    Push pai-kiro → ~/.kiro
  pull    Pull ~/.kiro → pai-kiro
  status  Show sync status
`);
}
