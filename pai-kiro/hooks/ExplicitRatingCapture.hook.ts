#!/usr/bin/env bun
// $PAI_DIR/hooks/ExplicitRatingCapture.hook.ts
// Captures explicit user ratings (1-10) and writes to LEARNING/SIGNALS/ratings.jsonl

import { appendFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Kiro CLI payload: { hook_event_name: "userPromptSubmit", cwd: string, prompt: string }
// Claude Code payload: { prompt: string, session_id?: string }
interface UserPromptPayload {
  // Kiro fields
  hook_event_name?: string;
  cwd?: string;
  // Common fields
  prompt: string;
  // Claude Code only
  session_id?: string;
}

interface Rating {
  timestamp: string;
  rating: number;
  session_id: string;
  comment: string;
}

// Unit words that indicate a number is not a rating
const UNIT_WORDS = [
  'items', 'files', 'lines', 'bytes', 'kb', 'mb', 'gb',
  'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years',
  'times', 'attempts', 'tries', 'errors', 'warnings',
  'users', 'requests', 'responses', 'records', 'rows', 'columns',
  'have', 'has', 'got', 'found', 'see', 'there', 'are', 'is',
  'step', 'steps', 'phase', 'phases', 'version', 'port'
];

/**
 * Parse a rating from user input
 * Valid formats: "7", "8 - good work", "6: needs improvement", "9/10"
 * Returns null if not a valid rating
 */
function parseRating(text: string): { rating: number; comment: string } | null {
  const trimmed = text.trim();

  // Pattern: starts with a number 1-10, optionally followed by separator and comment
  // ^(10|[1-9])(?:\s*[-:\/]\s*|\s+)?(.*)$
  const match = trimmed.match(/^(10|[1-9])(?:\s*[-:\/]\s*|\s+)?(.*)$/);

  if (!match) {
    return null;
  }

  const rating = parseInt(match[1], 10);
  const comment = match[2]?.trim() || '';

  // Filter out false positives
  // Check if comment starts with unit words
  const commentLower = comment.toLowerCase();
  for (const unit of UNIT_WORDS) {
    if (commentLower.startsWith(unit)) {
      return null;
    }
  }

  // If no comment, check if the entire input is just the number
  // (to avoid triggering on things like "step 7" or "version 8")
  if (!comment && trimmed !== match[1]) {
    return null;
  }

  return { rating, comment };
}

function getLocalTimestamp(): string {
  const date = new Date();
  const tz = process.env.TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    return date.toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T');
  } catch {
    return date.toISOString();
  }
}

function getRatingsFilePath(): string {
  const paiDir = process.env.PAI_DIR || join(homedir(), '.claude');
  return join(paiDir, 'memory', 'LEARNING', 'SIGNALS', 'ratings.jsonl');
}

function ensureDirectoryExists(filePath: string): void {
  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeRating(rating: Rating): void {
  const filePath = getRatingsFilePath();
  ensureDirectoryExists(filePath);

  const line = JSON.stringify(rating) + '\n';
  appendFileSync(filePath, line, 'utf-8');
}

function createLowRatingLearning(rating: Rating): void {
  if (rating.rating >= 6) {
    return;
  }

  const paiDir = process.env.PAI_DIR || join(homedir(), '.claude');
  const now = new Date();
  const tz = process.env.TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0];

  const monthDir = join(paiDir, 'memory', 'LEARNING', 'ALGORITHM', `${year}-${month}`);
  if (!existsSync(monthDir)) {
    mkdirSync(monthDir, { recursive: true });
  }

  const filename = `${timestamp}_RATING_${rating.rating}-needs-improvement.md`;
  const filepath = join(monthDir, filename);

  const content = `---
capture_type: LOW_RATING
timestamp: ${rating.timestamp}
session_id: ${rating.session_id}
rating: ${rating.rating}
---

# Low Rating Alert: ${rating.rating}/10

## User Feedback
${rating.comment || '(No comment provided)'}

## Action Required
Review the recent work in this session to identify what went wrong.

---

*Auto-captured by ExplicitRatingCapture hook*
`;

  writeFileSync(filepath, content, 'utf-8');
  console.error(`⚠️ Low rating (${rating.rating}/10) captured to LEARNING/ALGORITHM/`);
}

async function main() {
  try {
    const stdinData = await Bun.stdin.text();
    if (!stdinData.trim()) {
      process.exit(0);
    }

    const payload: UserPromptPayload = JSON.parse(stdinData);

    if (!payload.prompt) {
      process.exit(0);
    }

    const parsed = parseRating(payload.prompt);

    if (!parsed) {
      // Not a rating, exit silently
      process.exit(0);
    }

    const rating: Rating = {
      timestamp: getLocalTimestamp(),
      rating: parsed.rating,
      session_id: payload.session_id || 'unknown',
      comment: parsed.comment
    };

    // Write to ratings.jsonl
    writeRating(rating);

    // If low rating, create a learning entry
    createLowRatingLearning(rating);

    // Output feedback
    const emoji = rating.rating >= 8 ? '🌟' : rating.rating >= 6 ? '👍' : '📝';
    console.error(`${emoji} Rating ${rating.rating}/10 recorded${rating.comment ? `: ${rating.comment}` : ''}`);

  } catch (error) {
    // Silent failure - don't disrupt user experience
    console.error('ExplicitRatingCapture error:', error);
  }

  process.exit(0);
}

main();
