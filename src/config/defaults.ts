import { homedir } from 'os';
import { join } from 'path';
import type { KairosConfig } from './schema.js';

const HOME = homedir();
const IS_WINDOWS = process.platform === 'win32';

const KAIROS_DIR = IS_WINDOWS ? join(HOME, 'AppData', 'Local', 'Kairos') : join(HOME, '.kairos');

export const DEFAULT_CONFIG: KairosConfig = {
  version: '0.1.1',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1',
    maxTokens: 8192,
    temperature: 0.7,
    fallbackEnabled: true,
    autoDiscoverLocal: true,
  },
  tools: {
    enabled: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
    disabled: [],
    custom: [],
    confirmBeforeExecute: true,
    maxConcurrent: 4,
  },
  safety: {
    enabled: true,
    allowedRiskLevels: ['read', 'write', 'execute'],
    blockedCommands: ['rm -rf /', 'format', 'del /s /q'],
    blockedPaths: ['/etc', '/System', '/Windows/System32'],
    autoApprove: false,
    requireConfirmationFor: ['bash', 'write', 'edit'],
  },
  tui: {
    theme: 'default',
    showTimestamps: true,
    showTokenCount: true,
    showCost: false,
    compactMode: false,
    useColors: true,
  },
  memory: {
    enabled: true,
    persistToDisk: true,
    maxSessionSize: 1024 * 1024,
    compressThreshold: 512 * 1024,
    ttlDays: 30,
  },
  daemon: {
    enabled: false,
    port: 7777,
    maxWorkers: 4,
    taskTimeout: 300000,
    heartbeatInterval: 5000,
    pidFile: join(KAIROS_DIR, 'daemon.pid'),
    logFile: join(KAIROS_DIR, 'daemon.log'),
  },
  hooks: {
    enabled: false,
    preTool: [],
    postTool: [],
    preTurn: [],
    postTurn: [],
    onError: [],
  },
  extensions: {
    enabled: true,
    autoDiscover: true,
    searchPaths: [join(KAIROS_DIR, 'extensions')],
    loaded: [],
    disabled: [],
  },
  paths: {
    home: HOME,
    config: KAIROS_DIR,
    data: join(KAIROS_DIR, 'data'),
    cache: join(KAIROS_DIR, 'cache'),
    logs: join(KAIROS_DIR, 'logs'),
    sessions: join(KAIROS_DIR, 'sessions'),
    memory: join(KAIROS_DIR, 'memory'),
    extensions: join(KAIROS_DIR, 'extensions'),
  },
  webSearch: {
    provider: 'brave',
    mimoBaseUrl: 'https://api.xiaomimimo.com/v1',
    mimoModel: 'mimo-v2.5',
    maxResults: 5,
    fetchContent: false,
    fetchTimeout: 10000,
    maxContentLength: 8000,
  },
};

export function getDefaultConfigPath(): string {
  return join(KAIROS_DIR, 'config.json');
}

export function getProjectConfigPath(): string {
  return join(process.cwd(), '.kairos', 'config.json');
}

export function getKairosDir(): string {
  return KAIROS_DIR;
}
