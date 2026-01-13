#!/usr/bin/env bun
// ~/.kiro/hooks/capture-all-events.ts
// Captures ALL Kiro CLI hook events to JSONL

import { readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

// Get script directory for reliable imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from absolute paths
import { enrichEventWithAgentMetadata, isAgentSpawningCall } from './lib/metadata-extraction';
import { sendEventToObservability, getCurrentTimestamp } from './lib/observability';

interface HookEvent {
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  timestamp: number;
  timestamp_local: string;
}

function getPaiDir(): string {
  return process.env.PAI_DIR || join(homedir(), '.kiro');
}

function debugLog(message: string, data?: any): void {
  const debugFile = join(getPaiDir(), 'hooks-debug.log');
  const timestamp = new Date().toISOString();
  const logLine = data
    ? `[${timestamp}] ${message}: ${JSON.stringify(data)}\n`
    : `[${timestamp}] ${message}\n`;

  try {
    appendFileSync(debugFile, logLine, 'utf-8');
  } catch {
    // Ignore debug logging errors
  }
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
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return new Date().toISOString();
  }
}

function getEventsFilePath(): string {
  const kiroDir = getPaiDir();
  const now = new Date();
  const tz = process.env.TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');

  const monthDir = join(kiroDir, 'memory', 'history', 'raw-outputs', `${year}-${month}`);

  if (!existsSync(monthDir)) {
    mkdirSync(monthDir, { recursive: true });
  }

  return join(monthDir, `${year}-${month}-${day}_all-events.jsonl`);
}

function getSessionMappingFile(): string {
  return join(getPaiDir(), 'agent-sessions.json');
}

function getAgentForSession(sessionId: string): string {
  try {
    const mappingFile = getSessionMappingFile();
    if (existsSync(mappingFile)) {
      const mappings = JSON.parse(readFileSync(mappingFile, 'utf-8'));
      return mappings[sessionId] || process.env.DA || 'kiro';
    }
  } catch {
    // Ignore errors
  }
  return process.env.DA || 'kiro';
}

function setAgentForSession(sessionId: string, agentName: string): void {
  try {
    const mappingFile = getSessionMappingFile();
    let mappings: Record<string, string> = {};

    if (existsSync(mappingFile)) {
      mappings = JSON.parse(readFileSync(mappingFile, 'utf-8'));
    }

    mappings[sessionId] = agentName;
    writeFileSync(mappingFile, JSON.stringify(mappings, null, 2), 'utf-8');
  } catch {
    // Silently fail
  }
}

async function main() {
  debugLog('capture-all-events.ts started', { args: process.argv });

  try {
    const args = process.argv.slice(2);
    const eventTypeIndex = args.indexOf('--event-type');

    if (eventTypeIndex === -1) {
      debugLog('Missing --event-type argument');
      console.error('Missing --event-type argument');
      process.exit(0);
    }

    const eventType = args[eventTypeIndex + 1];
    debugLog('Event type', eventType);

    // Read stdin - Kiro CLI sends JSON here
    const stdinData = await Bun.stdin.text();
    debugLog('Received stdin', stdinData.substring(0, 500));

    if (!stdinData || stdinData.trim() === '') {
      debugLog('Empty stdin received');
      process.exit(0);
    }

    let hookData: Record<string, any>;
    try {
      hookData = JSON.parse(stdinData);
    } catch (parseError) {
      debugLog('JSON parse error', { error: String(parseError), data: stdinData });
      process.exit(0);
    }

    debugLog('Parsed hook data', hookData);

    // Kiro CLI format: hook_event_name, cwd, tool_name, tool_input, tool_response
    // Generate session_id from cwd if not provided
    const sessionId = hookData.session_id || hookData.cwd || 'main';
    let agentName = getAgentForSession(sessionId);

    // Update agent mapping based on event type
    if (hookData.tool_name === 'Task' && hookData.tool_input?.subagent_type) {
      agentName = hookData.tool_input.subagent_type;
      setAgentForSession(sessionId, agentName);
    } else if (eventType === 'SubagentStop' || eventType === 'Stop') {
      agentName = process.env.DA || 'kiro';
      setAgentForSession(sessionId, agentName);
    } else if (process.env.PAI_AGENT) {
      agentName = process.env.PAI_AGENT;
      setAgentForSession(sessionId, agentName);
    } else if (hookData.agent_type) {
      agentName = hookData.agent_type;
      setAgentForSession(sessionId, agentName);
    }

    let event: HookEvent = {
      source_app: agentName,
      session_id: sessionId,
      hook_event_type: eventType,
      payload: hookData,
      timestamp: Date.now(),
      timestamp_local: getLocalTimestamp()
    };

    // Enrich with agent instance metadata for Task calls
    if (isAgentSpawningCall(hookData.tool_name, hookData.tool_input)) {
      event = enrichEventWithAgentMetadata(event, hookData.tool_input, hookData.description);
    }

    // Append to events file
    const eventsFile = getEventsFilePath();
    const jsonLine = JSON.stringify(event) + '\n';
    appendFileSync(eventsFile, jsonLine, 'utf-8');
    debugLog('Written to events file', eventsFile);

    // Send to observability server
    const observabilityUrl = process.env.PAI_OBSERVABILITY_URL || 'http://localhost:4000/events';
    debugLog('Sending to observability', observabilityUrl);

    await sendEventToObservability({
      source_app: event.source_app,
      session_id: event.session_id,
      hook_event_type: eventType as any,
      timestamp: getCurrentTimestamp(),
      tool_name: hookData.tool_name,
      tool_input: hookData.tool_input,
      agent_type: agentName
    });

    debugLog('Event sent successfully');

  } catch (error) {
    debugLog('Event capture error', { error: String(error), stack: (error as Error).stack });
    console.error('Event capture error:', error);
  }

  process.exit(0);
}

main();
