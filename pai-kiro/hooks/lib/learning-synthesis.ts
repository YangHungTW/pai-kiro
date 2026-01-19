// $KIRO_DIR/hooks/lib/learning-synthesis.ts
// Learning synthesis utilities for generating weekly reports and pattern analysis

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface Rating {
  timestamp: string;
  rating: number;
  session_id: string;
  comment: string;
}

export interface Learning {
  filepath: string;
  category: string;
  timestamp: string;
  title: string;
  insight: string;
  fullContent: string;
}

export interface WeeklyReport {
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  ratingsSummary: {
    count: number;
    average: number;
    lowest: number;
    lowestComment: string;
    trend: 'up' | 'stable' | 'down';
  } | null;
  patterns: { pattern: string; count: number }[];
  learningsCount: {
    system: number;
    algorithm: number;
  };
  recommendations: string[];
}

function getKiroDir(): string {
  return process.env.KIRO_DIR || join(homedir(), '.kiro');
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1);
  const days = (week - 1) * 7 - jan1.getDay() + 1;
  const start = new Date(year, 0, days);
  const end = new Date(year, 0, days + 6);
  return { start, end };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Load all ratings from the last N days
 */
export function loadRatingsForPeriod(days: number = 7): Rating[] {
  const filePath = join(getKiroDir(), 'memory', 'LEARNING', 'SIGNALS', 'ratings.jsonl');

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const ratings: Rating[] = [];
    for (const line of lines) {
      try {
        const rating = JSON.parse(line) as Rating;
        const ratingDate = new Date(rating.timestamp);
        if (ratingDate >= cutoff) {
          ratings.push(rating);
        }
      } catch {
        continue;
      }
    }

    return ratings;
  } catch {
    return [];
  }
}

/**
 * Load all learnings from a specific period
 */
export function loadLearningsForPeriod(days: number = 7): Learning[] {
  const kiroDir = getKiroDir();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

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

      for (const monthDir of monthDirs.slice(0, 2)) { // Only check recent 2 months
        const monthPath = join(categoryDir, monthDir);
        const files = readdirSync(monthPath)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();

        for (const file of files) {
          const filepath = join(monthPath, file);
          const learning = parseLearningFileFull(filepath, category);
          if (learning) {
            const learningDate = new Date(learning.timestamp);
            if (learningDate >= cutoff) {
              learnings.push(learning);
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return learnings.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function parseLearningFileFull(filepath: string, category: string): Learning | null {
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
    const insight = insightMatch ? insightMatch[1].trim() : '';

    return {
      filepath,
      category,
      timestamp,
      title,
      insight,
      fullContent: content
    };
  } catch {
    return null;
  }
}

/**
 * Analyze rating trends
 */
export function analyzeRatingTrend(ratings: Rating[]): WeeklyReport['ratingsSummary'] {
  if (ratings.length === 0) {
    return null;
  }

  const sortedRatings = [...ratings].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const total = sortedRatings.reduce((sum, r) => sum + r.rating, 0);
  const average = total / sortedRatings.length;

  let lowest = sortedRatings[0];
  for (const r of sortedRatings) {
    if (r.rating < lowest.rating) {
      lowest = r;
    }
  }

  // Calculate trend (compare first half vs second half)
  let trend: 'up' | 'stable' | 'down' = 'stable';
  if (sortedRatings.length >= 4) {
    const mid = Math.floor(sortedRatings.length / 2);
    const firstHalf = sortedRatings.slice(0, mid);
    const secondHalf = sortedRatings.slice(mid);

    const firstAvg = firstHalf.reduce((s, r) => s + r.rating, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.rating, 0) / secondHalf.length;

    if (secondAvg - firstAvg > 0.5) {
      trend = 'up';
    } else if (firstAvg - secondAvg > 0.5) {
      trend = 'down';
    }
  }

  return {
    count: sortedRatings.length,
    average: Math.round(average * 10) / 10,
    lowest: lowest.rating,
    lowestComment: lowest.comment || '(no comment)',
    trend
  };
}

/**
 * Extract common patterns from learnings
 */
export function extractPatterns(learnings: Learning[]): { pattern: string; count: number }[] {
  const wordCounts = new Map<string, number>();

  // Keywords to look for patterns
  const patternWords = [
    'hook', 'mcp', 'api', 'config', 'permission', 'path', 'directory',
    'bug', 'fix', 'error', 'validation', 'async', 'timeout', 'memory',
    'performance', 'cache', 'database', 'query', 'auth', 'token',
    'test', 'type', 'typescript', 'import', 'export', 'module'
  ];

  for (const learning of learnings) {
    const text = (learning.title + ' ' + learning.insight).toLowerCase();

    for (const word of patternWords) {
      if (text.includes(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  // Sort by count and return top patterns
  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 2)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Generate recommendations based on analysis
 */
export function generateRecommendations(
  ratingsSummary: WeeklyReport['ratingsSummary'],
  patterns: { pattern: string; count: number }[],
  learnings: Learning[]
): string[] {
  const recommendations: string[] = [];

  // Rating-based recommendations
  if (ratingsSummary) {
    if (ratingsSummary.average < 6) {
      recommendations.push('Overall ratings are low - review recent feedback for common issues');
    }
    if (ratingsSummary.trend === 'down') {
      recommendations.push('Ratings are trending downward - investigate recent changes');
    }
    if (ratingsSummary.lowest < 5) {
      recommendations.push(`Address the low-rated issue: "${ratingsSummary.lowestComment}"`);
    }
  }

  // Pattern-based recommendations
  for (const p of patterns.slice(0, 3)) {
    if (p.count >= 3) {
      recommendations.push(`Recurring ${p.pattern} issues (${p.count}x) - consider creating a checklist`);
    }
  }

  // Learning category imbalance
  const systemCount = learnings.filter(l => l.category === 'SYSTEM').length;
  const algorithmCount = learnings.filter(l => l.category === 'ALGORITHM').length;

  if (systemCount > algorithmCount * 2) {
    recommendations.push('Many SYSTEM learnings - environment setup may need documentation');
  }
  if (algorithmCount > systemCount * 2) {
    recommendations.push('Many ALGORITHM learnings - consider code review practices');
  }

  return recommendations.slice(0, 5);
}

/**
 * Check if a weekly report already exists
 */
export function weeklyReportExists(year: number, week: number): boolean {
  const kiroDir = getKiroDir();
  const month = new Date(year, 0, week * 7).toISOString().slice(0, 7);
  const reportPath = join(kiroDir, 'memory', 'LEARNING', 'SYNTHESIS', month, `week-${week.toString().padStart(2, '0')}.md`);
  return existsSync(reportPath);
}

/**
 * Generate and save weekly report
 */
export function generateWeeklyReport(forceGenerate: boolean = false): WeeklyReport | null {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);

  // Check if report already exists (unless forced)
  if (!forceGenerate && weeklyReportExists(year, week)) {
    return null;
  }

  const ratings = loadRatingsForPeriod(7);
  const learnings = loadLearningsForPeriod(7);

  const ratingsSummary = analyzeRatingTrend(ratings);
  const patterns = extractPatterns(learnings);
  const recommendations = generateRecommendations(ratingsSummary, patterns, learnings);

  const { start, end } = getWeekDateRange(year, week);

  const report: WeeklyReport = {
    weekNumber: week,
    year,
    startDate: formatDate(start),
    endDate: formatDate(end),
    ratingsSummary,
    patterns,
    learningsCount: {
      system: learnings.filter(l => l.category === 'SYSTEM').length,
      algorithm: learnings.filter(l => l.category === 'ALGORITHM').length
    },
    recommendations
  };

  // Save the report
  saveWeeklyReport(report);

  return report;
}

/**
 * Save weekly report to file
 */
function saveWeeklyReport(report: WeeklyReport): void {
  const kiroDir = getKiroDir();
  const month = `${report.year}-${String(new Date(report.year, 0, report.weekNumber * 7).getMonth() + 1).padStart(2, '0')}`;
  const outputDir = join(kiroDir, 'memory', 'LEARNING', 'SYNTHESIS', month);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const filename = `week-${report.weekNumber.toString().padStart(2, '0')}.md`;
  const filepath = join(outputDir, filename);

  const trendEmoji = report.ratingsSummary?.trend === 'up' ? '↑' :
                     report.ratingsSummary?.trend === 'down' ? '↓' : '→';

  const content = `---
type: weekly-synthesis
year: ${report.year}
week: ${report.weekNumber}
generated: ${new Date().toISOString()}
---

# Weekly Learning Synthesis

**Week:** ${report.year}-W${report.weekNumber.toString().padStart(2, '0')}
**Period:** ${report.startDate} to ${report.endDate}

## Rating Summary

${report.ratingsSummary ? `
- **Count:** ${report.ratingsSummary.count} ratings
- **Average:** ${report.ratingsSummary.average} / 10
- **Lowest:** ${report.ratingsSummary.lowest} (${report.ratingsSummary.lowestComment})
- **Trend:** ${trendEmoji} ${report.ratingsSummary.trend}
` : '*No ratings this week*'}

## Learning Summary

- **SYSTEM:** ${report.learningsCount.system} learnings
- **ALGORITHM:** ${report.learningsCount.algorithm} learnings

## Recurring Patterns

${report.patterns.length > 0 ?
  report.patterns.map(p => `- **${p.pattern}:** appeared ${p.count} times`).join('\n') :
  '*No recurring patterns detected*'
}

## Recommendations

${report.recommendations.length > 0 ?
  report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') :
  '*No specific recommendations*'
}

---

*Auto-generated by PAI Learning System*
`;

  writeFileSync(filepath, content);
}

/**
 * Load the most recent weekly report
 */
export function loadLatestWeeklyReport(): string | null {
  const kiroDir = getKiroDir();
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
        return readFileSync(latestPath, 'utf-8');
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if it's Monday and we should generate a new weekly report
 */
export function shouldGenerateWeeklyReport(): boolean {
  const now = new Date();

  // Only generate on Monday
  if (now.getDay() !== 1) {
    return false;
  }

  const year = now.getFullYear();
  const week = getWeekNumber(now);

  return !weeklyReportExists(year, week);
}
