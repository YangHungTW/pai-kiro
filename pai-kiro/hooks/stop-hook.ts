#!/usr/bin/env bun
// ~/.kiro/hooks/stop-hook.ts
// Captures main agent work summaries and learnings to structured LEARNING/ directory
// NOTE: Kiro CLI's stop hook only provides { hook_event_name, cwd } - no response content
// Learning capture only works when response/transcript_path is available (Claude Code)

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Kiro CLI payload: { hook_event_name: "stop", cwd: string }
// Claude Code payload: { stop_hook_active, transcript_path?, response?, session_id? }
interface StopPayload {
  // Kiro fields
  hook_event_name?: string;
  cwd?: string;
  // Claude Code fields
  stop_hook_active?: boolean;
  transcript_path?: string;
  response?: string;
  session_id?: string;
}

type LearningCategory = 'SYSTEM' | 'ALGORITHM' | null;

// Indicators for learning detection
const LEARNING_INDICATORS = [
  'problem', 'solved', 'discovered', 'fixed', 'learned', 'realized',
  'figured out', 'root cause', 'debugging', 'issue was', 'turned out',
  'mistake', 'error', 'bug', 'solution', 'workaround', 'insight'
];

// Keywords that indicate SYSTEM category (tools, environment, configuration)
const SYSTEM_KEYWORDS = [
  'hook', 'mcp', 'tool', 'command', 'bash', 'shell', 'terminal',
  'config', 'configuration', 'setting', 'environment', 'env',
  'permission', 'security', 'path', 'directory', 'file system',
  'install', 'setup', 'runtime', 'bun', 'node', 'npm',
  'api key', 'token', 'auth', 'credential'
];

// Keywords that indicate ALGORITHM category (logic, code, methodology)
const ALGORITHM_KEYWORDS = [
  'bug', 'fix', 'refactor', 'implement', 'logic', 'algorithm',
  'pattern', 'architecture', 'design', 'approach', 'method',
  'function', 'class', 'module', 'component', 'test',
  'performance', 'optimization', 'memory', 'database', 'query',
  'api', 'endpoint', 'request', 'response', 'validation'
];

function getLocalTimestamp(): string {
  const date = new Date();
  const tz = process.env.TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getLocalDate(): string {
  const date = new Date();
  const tz = process.env.TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function countKeywordMatches(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  return keywords.filter(k => lowerText.includes(k.toLowerCase())).length;
}

function hasLearningIndicators(text: string): boolean {
  const matches = countKeywordMatches(text, LEARNING_INDICATORS);
  return matches >= 2;
}

function classifyLearning(text: string): LearningCategory {
  const systemScore = countKeywordMatches(text, SYSTEM_KEYWORDS);
  const algorithmScore = countKeywordMatches(text, ALGORITHM_KEYWORDS);

  if (systemScore === 0 && algorithmScore === 0) {
    return null;
  }

  // Default to ALGORITHM if scores are equal or algorithm wins
  return systemScore > algorithmScore ? 'SYSTEM' : 'ALGORITHM';
}

function extractSummary(response: string): string {
  // Look for COMPLETED section
  const completedMatch = response.match(/🎯\s*COMPLETED[:\s]*(.+?)(?:\n|$)/i);
  if (completedMatch) {
    return completedMatch[1].trim().slice(0, 100);
  }

  // Look for SUMMARY section
  const summaryMatch = response.match(/📋\s*SUMMARY[:\s]*(.+?)(?:\n|$)/i);
  if (summaryMatch) {
    return summaryMatch[1].trim().slice(0, 100);
  }

  // Look for Learning pattern
  const learningMatch = response.match(/(?:learned|discovered|realized|fixed)[:\s]*(.+?)(?:\n|$)/i);
  if (learningMatch) {
    return learningMatch[1].trim().slice(0, 100);
  }

  // Fallback: first meaningful line
  const lines = response.split('\n').filter(l => l.trim().length > 10);
  if (lines.length > 0) {
    return lines[0].trim().slice(0, 100);
  }

  return 'work-session';
}

function extractInsight(response: string): string {
  // Try to extract the key insight from the response
  const patterns = [
    /(?:the )?(?:problem|issue|bug) was[:\s]+(.+?)(?:\n|$)/i,
    /(?:root cause|cause)[:\s]+(.+?)(?:\n|$)/i,
    /(?:solution|fix|workaround)[:\s]+(.+?)(?:\n|$)/i,
    /(?:learned|discovered|realized)[:\s]+(.+?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match && match[1].length > 20) {
      return match[1].trim().slice(0, 500);
    }
  }

  // Fallback: first paragraph after skipping any frontmatter
  const paragraphs = response.split('\n\n').filter(p => p.trim().length > 50);
  if (paragraphs.length > 0) {
    return paragraphs[0].trim().slice(0, 500);
  }

  return response.slice(0, 500);
}

function generateFilename(type: string, description: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0];
  const kebab = description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${timestamp}_${type}_${kebab}.md`;
}

function extractResponseFromTranscript(transcriptPath: string): string | null {
  try {
    if (!existsSync(transcriptPath)) {
      return null;
    }

    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      return null;
    }

    // Find the last assistant message by iterating backwards
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message?.content) {
          const contentArray = Array.isArray(entry.message.content)
            ? entry.message.content
            : [entry.message.content];

          const response = contentArray
            .map((c: any) => {
              if (typeof c === 'string') return c;
              if (c?.text) return c.text;
              if (c?.content) return String(c.content);
              return '';
            })
            .join('\n')
            .trim();

          if (response && response.length > 50) {
            return response;
          }
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function main() {
  try {
    const stdinData = await Bun.stdin.text();
    if (!stdinData.trim()) {
      process.exit(0);
    }

    const payload: StopPayload = JSON.parse(stdinData);

    // Detect Kiro CLI (only has hook_event_name and cwd, no response content)
    const isKiro = payload.hook_event_name === 'stop' && !payload.response && !payload.transcript_path;

    if (isKiro) {
      // Kiro doesn't provide response content - skip learning capture
      // Learning system relies on ExplicitRatingCapture for Kiro
      console.log('📋 Session ended (Kiro mode - learning capture via ratings only)');
      process.exit(0);
    }

    // Claude Code path - has response content
    let response = payload.response;
    if (!response && payload.transcript_path) {
      response = extractResponseFromTranscript(payload.transcript_path) || undefined;
    }

    if (!response) {
      process.exit(0);
    }

    const paiDir = process.env.PAI_DIR || join(homedir(), '.kiro');
    const isLearning = hasLearningIndicators(response);

    const now = new Date();
    const tz = process.env.TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const yearMonth = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}`;

    if (isLearning) {
      // Classify and write to LEARNING directory
      const category = classifyLearning(response) || 'ALGORITHM';
      const outputDir = join(paiDir, 'memory', 'LEARNING', category, yearMonth);

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const summary = extractSummary(response);
      const insight = extractInsight(response);
      const filename = generateFilename('LEARNING', summary);
      const filepath = join(outputDir, filename);

      const content = `---
capture_type: LEARNING
category: ${category}
timestamp: ${getLocalTimestamp()}
session_id: ${payload.session_id || 'unknown'}
---

# Learning: ${summary}

**Date:** ${getLocalDate()}
**Category:** ${category}
**Session:** ${payload.session_id || 'unknown'}

## Insight

${insight}

## Full Context

${response.slice(0, 3000)}

---

*Auto-captured by PAI Learning System*
`;

      writeFileSync(filepath, content);
      console.log(`📚 Learning captured to LEARNING/${category}/${yearMonth}/${filename}`);

    } else {
      // Write to sessions as before
      const outputDir = join(paiDir, 'memory', 'history', 'sessions', yearMonth);

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const summary = extractSummary(response);
      const filename = generateFilename('SESSION', summary);
      const filepath = join(outputDir, filename);

      const truncatedResponse = response.slice(0, 5000);

      const content = `---
capture_type: SESSION
timestamp: ${getLocalTimestamp()}
session_id: ${payload.session_id || 'unknown'}
executor: main
---

# SESSION: ${summary}

${truncatedResponse}

---

*Captured by PAI History System*
`;

      writeFileSync(filepath, content);
      console.log(`📝 Session captured to history/sessions/${yearMonth}/${filename}`);
    }

  } catch (error) {
    console.error('Stop hook error:', error);
  }

  process.exit(0);
}

main();
