#!/usr/bin/env bun
// ~/.kiro/hooks/load-core-context.ts
// SessionStart hook: Inject skill/context files, memory state and learning context into AI context

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Kiro CLI payload: { hook_event_name: "agentSpawn", cwd: string }
// Claude Code payload: { session_id: string, ... }
interface SessionStartPayload {
  // Kiro fields
  hook_event_name?: string;
  cwd?: string;
  // Claude Code fields
  session_id?: string;
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

// ========== Learning Context Loading ==========

interface Rating {
  timestamp: string;
  rating: number;
  session_id: string;
  comment: string;
}

interface Learning {
  category: string;
  timestamp: string;
  title: string;
  insight: string;
}

function loadRecentRatings(kiroDir: string, limit: number = 5): Rating[] {
  const filePath = join(kiroDir, 'memory', 'LEARNING', 'SIGNALS', 'ratings.jsonl');

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());

    const ratings: Rating[] = [];
    for (const line of lines) {
      try {
        ratings.push(JSON.parse(line));
      } catch {
        continue;
      }
    }

    return ratings.slice(-limit);
  } catch {
    return [];
  }
}

function loadRecentLearnings(kiroDir: string, limit: number = 3): Learning[] {
  const learnings: Learning[] = [];

  for (const category of ['SYSTEM', 'ALGORITHM']) {
    const categoryDir = join(kiroDir, 'memory', 'LEARNING', category);

    if (!existsSync(categoryDir)) {
      continue;
    }

    try {
      const monthDirs = readdirSync(categoryDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
        .map(d => d.name)
        .sort()
        .reverse();

      for (const monthDir of monthDirs) {
        const monthPath = join(categoryDir, monthDir);
        const files = readdirSync(monthPath)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();

        for (const file of files) {
          if (learnings.length >= limit * 2) break;

          const filepath = join(monthPath, file);
          const learning = parseLearningFile(filepath, category);
          if (learning) {
            learnings.push(learning);
          }
        }

        if (learnings.length >= limit * 2) break;
      }
    } catch {
      continue;
    }
  }

  return learnings
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

function parseLearningFile(filepath: string, category: string): Learning | null {
  try {
    const content = readFileSync(filepath, 'utf-8');

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = frontmatterMatch[1];
    const timestampMatch = frontmatter.match(/timestamp:\s*(.+)/);
    const timestamp = timestampMatch ? timestampMatch[1].trim() : '';

    const titleMatch = content.match(/^#\s*Learning:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    const insightMatch = content.match(/## Insight\n\n([\s\S]*?)(?=\n##|$)/);
    const insight = insightMatch ? insightMatch[1].trim().slice(0, 200) : '';

    return { category, timestamp, title, insight };
  } catch {
    return null;
  }
}

function formatLearningContext(ratings: Rating[], learnings: Learning[]): string {
  if (ratings.length === 0 && learnings.length === 0) {
    return '';
  }

  const lines: string[] = ['## Recent Learning Context'];

  if (ratings.length > 0) {
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    const lowRatings = ratings.filter(r => r.rating < 6);

    lines.push('');
    lines.push(`### Recent Ratings (avg: ${avgRating.toFixed(1)}/10)`);

    if (lowRatings.length > 0) {
      lines.push('');
      lines.push('⚠️ **Low ratings detected - pay attention to these issues:**');
      for (const r of lowRatings) {
        lines.push(`- ${r.rating}/10: ${r.comment || '(no comment)'}`);
      }
    }
  }

  if (learnings.length > 0) {
    lines.push('');
    lines.push('### Recent Learnings');
    lines.push('');

    for (const l of learnings) {
      lines.push(`**[${l.category}]** ${l.title}`);
      if (l.insight) {
        lines.push(`> ${l.insight.slice(0, 150)}...`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ========== Weekly Synthesis Loading ==========

function loadLatestWeeklySynthesis(kiroDir: string): string | null {
  const synthesisDir = join(kiroDir, 'memory', 'LEARNING', 'SYNTHESIS');

  if (!existsSync(synthesisDir)) {
    return null;
  }

  try {
    const monthDirs = readdirSync(synthesisDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    for (const monthDir of monthDirs) {
      const monthPath = join(synthesisDir, monthDir);
      const files = readdirSync(monthPath)
        .filter(f => f.startsWith('week-') && f.endsWith('.md'))
        .sort()
        .reverse();

      if (files.length > 0) {
        const latestPath = join(monthPath, files[0]);
        const content = readFileSync(latestPath, 'utf-8');

        // Extract just the key sections (not full file)
        const summaryMatch = content.match(/## Rating Summary[\s\S]*?(?=## Learning Summary|$)/);
        const recommendationsMatch = content.match(/## Recommendations[\s\S]*?(?=---|$)/);

        if (summaryMatch || recommendationsMatch) {
          const lines: string[] = ['### 📊 Latest Weekly Synthesis'];

          if (summaryMatch) {
            lines.push('');
            lines.push(summaryMatch[0].trim());
          }

          if (recommendationsMatch) {
            lines.push('');
            lines.push(recommendationsMatch[0].trim());
          }

          return lines.join('\n');
        }
      }
    }

    return null;
  } catch {
    return null;
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

    // Load recent learnings and ratings
    const ratings = loadRecentRatings(kiroDir, 5);
    const learnings = loadRecentLearnings(kiroDir, 3);
    const learningContext = formatLearningContext(ratings, learnings);

    // Load latest weekly synthesis
    const weeklySynthesis = loadLatestWeeklySynthesis(kiroDir);

    // Combine learning context with synthesis
    let fullLearningContext = '';
    if (learningContext || weeklySynthesis) {
      fullLearningContext = '\n---\n\n';
      if (learningContext) {
        fullLearningContext += learningContext;
      }
      if (weeklySynthesis) {
        fullLearningContext += (learningContext ? '\n\n' : '') + weeklySynthesis;
      }
    }

    const output = `<system-reminder>
CORE CONTEXT (Auto-loaded at Session Start)

📅 CURRENT DATE/TIME: ${getLocalTimestamp()}

The following context has been loaded from ${coreSkillPath}:

${skillContent}
${memoryState}${recentSessions}
${fullLearningContext}

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
