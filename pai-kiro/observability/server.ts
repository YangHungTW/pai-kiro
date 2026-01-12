#!/usr/bin/env bun
/**
 * Observability Server for Personal AI Infrastructure
 *
 * Receives events from hooks and provides a simple dashboard.
 *
 * Usage:
 *   bun run ~/.kiro/observability/server.ts
 *
 * Endpoints:
 *   POST /events     - Receive events from hooks
 *   GET  /events     - List recent events (JSON)
 *   GET  /           - Simple dashboard (HTML)
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PORT = parseInt(process.env.PAI_OBSERVABILITY_PORT || '4000');
const KIRO_DIR = process.env.KIRO_DIR || join(homedir(), '.kiro');
const EVENTS_DIR = join(KIRO_DIR, 'memory', 'signals');
const EVENTS_FILE = join(EVENTS_DIR, 'events.jsonl');

// Ensure events directory exists
if (!existsSync(EVENTS_DIR)) {
  mkdirSync(EVENTS_DIR, { recursive: true });
}

// In-memory buffer for recent events (last 100)
const recentEvents: any[] = [];
const MAX_EVENTS = 100;

function addEvent(event: any) {
  // Add to in-memory buffer
  recentEvents.push(event);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.shift();
  }

  // Append to file
  appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n');
}

function getRecentEvents(limit: number = 50): any[] {
  return recentEvents.slice(-limit).reverse();
}

function renderDashboard(): string {
  const events = getRecentEvents(50);
  const eventRows = events.map(e => `
    <tr>
      <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
      <td><span class="badge ${e.hook_event_type}">${e.hook_event_type}</span></td>
      <td>${e.tool_name || '-'}</td>
      <td>${e.summary || e.tool_input?.command?.slice(0, 50) || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>PAI Observability</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body { font-family: -apple-system, sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #00d9ff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #16213e; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .PreToolUse { background: #f39c12; color: #000; }
    .PostToolUse { background: #27ae60; color: #fff; }
    .UserPromptSubmit { background: #3498db; color: #fff; }
    .Stop { background: #e74c3c; color: #fff; }
    .SessionStart { background: #9b59b6; color: #fff; }
    .stats { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: #16213e; padding: 15px; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #00d9ff; }
  </style>
</head>
<body>
  <h1>🔭 PAI Observability</h1>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${recentEvents.length}</div>
      <div>Total Events</div>
    </div>
    <div class="stat">
      <div class="stat-value">${recentEvents.filter(e => e.hook_event_type === 'PreToolUse').length}</div>
      <div>Tool Uses</div>
    </div>
    <div class="stat">
      <div class="stat-value">${recentEvents.filter(e => e.hook_event_type === 'UserPromptSubmit').length}</div>
      <div>Prompts</div>
    </div>
  </div>

  <h2>Recent Events</h2>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Type</th>
        <th>Tool</th>
        <th>Summary</th>
      </tr>
    </thead>
    <tbody>
      ${eventRows || '<tr><td colspan="4">No events yet</td></tr>'}
    </tbody>
  </table>

  <p style="color: #666; font-size: 12px; margin-top: 20px;">
    Auto-refreshes every 5 seconds. API: GET /events
  </p>
</body>
</html>`;
}

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // POST /events - Receive events
    if (req.method === 'POST' && url.pathname === '/events') {
      return req.json().then(event => {
        addEvent(event);
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }).catch(() => {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      });
    }

    // GET /events - List events
    if (req.method === 'GET' && url.pathname === '/events') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      return new Response(JSON.stringify(getRecentEvents(limit)), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET / - Dashboard
    if (req.method === 'GET' && url.pathname === '/') {
      return new Response(renderDashboard(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
});

console.log(`🔭 Observability server running at http://localhost:${PORT}`);
console.log(`   Dashboard: http://localhost:${PORT}/`);
console.log(`   Events API: http://localhost:${PORT}/events`);
console.log(`   Events file: ${EVENTS_FILE}`);
