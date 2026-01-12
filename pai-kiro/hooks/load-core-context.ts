#!/usr/bin/env bun
// ~/.kiro/hooks/load-core-context.ts
// SessionStart hook: Inject skill/context files and memory state into AI context

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface SessionStartPayload {
  session_id: string;
  [key: string]: any;
}

function isSubagentSession(): boolean {
  return process.env.KIRO_AGENT !== undefined ||
         process.env.SUBAGENT === 'true';
}

function getLocalTimestamp(): string {
  const date = new Date();
  const tz = process.env.TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} CST`;
  } catch {
    return new Date().toISOString();
  }
}

function loadMemoryState(kiroDir: string): string {
  const activeWorkPath = join(kiroDir, 'memory', 'state', 'active-work.json');

  if (!existsSync(activeWorkPath)) {
    return '';
  }

  try {
    const content = readFileSync(activeWorkPath, 'utf-8');
    const state = JSON.parse(content);

    if (!state.current_task) {
      return '';
    }

    return `
## 📌 Active Work (from memory)
- **Task:** ${state.current_task}
- **Project:** ${state.project || 'N/A'}
- **Started:** ${state.started_at || 'N/A'}
- **Context:** ${state.context?.join(', ') || 'N/A'}

Consider: Is this session related to the above work? If so, continue from where you left off.
`;
  } catch {
    return '';
  }
}

function getRecentSessions(kiroDir: string, limit: number = 3): string {
  const sessionsDir = join(kiroDir, 'memory', 'history', 'sessions');

  if (!existsSync(sessionsDir)) {
    return '';
  }

  try {
    const { readdirSync, statSync } = require('fs');

    // Get all year-month directories
    const yearMonths = readdirSync(sessionsDir)
      .filter((d: string) => /^\d{4}-\d{2}$/.test(d))
      .sort()
      .reverse();

    if (yearMonths.length === 0) {
      return '';
    }

    // Get recent session files
    const sessions: { file: string; mtime: number }[] = [];
    for (const ym of yearMonths.slice(0, 2)) {
      const ymDir = join(sessionsDir, ym);
      const files = readdirSync(ymDir).filter((f: string) => f.endsWith('.md'));
      for (const file of files) {
        const filepath = join(ymDir, file);
        const stat = statSync(filepath);
        sessions.push({ file: `${ym}/${file}`, mtime: stat.mtimeMs });
      }
    }

    sessions.sort((a, b) => b.mtime - a.mtime);
    const recent = sessions.slice(0, limit);

    if (recent.length === 0) {
      return '';
    }

    return `
## 📜 Recent Sessions
${recent.map(s => `- \`memory/history/sessions/${s.file}\``).join('\n')}

Use \`cat ~/.kiro/memory/history/sessions/[file]\` to review if relevant.
`;
  } catch {
    return '';
  }
}

async function main() {
  try {
    if (isSubagentSession()) {
      process.exit(0);
    }

    const stdinData = await Bun.stdin.text();
    if (!stdinData.trim()) {
      process.exit(0);
    }

    const payload: SessionStartPayload = JSON.parse(stdinData);
    const kiroDir = process.env.KIRO_DIR || join(homedir(), '.kiro');

    const coreSkillPath = join(kiroDir, 'skills', 'CORE', 'SKILL.md');

    if (!existsSync(coreSkillPath)) {
      console.error('[PaiLang] No CORE skill found - skipping context injection');
      process.exit(0);
    }

    const skillContent = readFileSync(coreSkillPath, 'utf-8');
    const memoryState = loadMemoryState(kiroDir);
    const recentSessions = getRecentSessions(kiroDir);

    const output = `<system-reminder>
CORE CONTEXT (Auto-loaded at Session Start)

📅 CURRENT DATE/TIME: ${getLocalTimestamp()}

The following context has been loaded from ${coreSkillPath}:

${skillContent}
${memoryState}${recentSessions}
This context is now active for this session. Follow all instructions, preferences, and guidelines contained above.
</system-reminder>

✅ Context successfully loaded...`;

    console.log(output);

  } catch (error) {
    console.error('Context loading error:', error);
  }

  process.exit(0);
}

main();
