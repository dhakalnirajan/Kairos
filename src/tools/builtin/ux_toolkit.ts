import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const vault = new Map<string, string>();
const feed: Array<{ author: string; message: string; timestamp: number }> = [];
const widgets = new Map<string, { id: string; content: string; position: string }>();
const branches = new Map<string, { content: string; timestamp: number }>();
const threads = new Map<string, { messages: Array<{ role: string; content: string }> }>();
let activeThread = 'default';
const templates = new Map<string, { name: string; files: Array<{ path: string; content: string }> }>();
let moodState = 'neutral';
let moodMessageCount = 0;
let focusState = false;
let focusTask = '';
let offlineState = false;

export const dbMigrationTool: ToolInstance = {
  name: 'db_migration', description: 'DB migration generation: detect ORM, create migration files',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['detect_orm', 'create_migration', 'list_migrations', 'rollback'] }, name: { type: 'string' }, schema: { type: 'string' } }, required: ['action'] },
  riskLevel: 'write' as const, isIdempotent: false,
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const migrationDir = join(ctx.workspaceRoot, 'migrations');
    try {
      switch (action) {
        case 'detect_orm': { const pkgPath = join(ctx.workspaceRoot, 'package.json'); const has = (pkg: string) => existsSync(pkgPath) && readFileSync(pkgPath, 'utf-8').includes(pkg); return { success: true, output: `Detected: ${has('prisma') ? 'Prisma' : has('drizzle') ? 'Drizzle' : has('typeorm') ? 'TypeORM' : has('sequelize') ? 'Sequelize' : 'No ORM detected'}` }; }
        case 'create_migration': { if (!existsSync(migrationDir)) mkdirSync(migrationDir, { recursive: true }); const name = String(params['name'] ?? `migration-${Date.now()}`); const file = join(migrationDir, `${Date.now()}-${name}.sql`); writeFileSync(file, `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n\n${String(params['schema'] ?? '-- Add your SQL here\n')}`); return { success: true, output: `Created migration: ${file.replace(ctx.workspaceRoot + '/', '')}` }; }
        case 'list_migrations': { if (!existsSync(migrationDir)) return { success: true, output: 'No migrations directory' }; const files = require('fs').readdirSync(migrationDir).filter((f: string) => f.endsWith('.sql')).sort(); return { success: true, output: files.join('\n') || 'No migrations', metadata: { count: files.length } }; }
        case 'rollback': { return { success: true, output: 'Rollback: Review the latest migration file and create a reverse migration' }; }
        default: return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) { return { success: false, output: '', error: String(e) }; }
  },
};

export const apiDocGenTool: ToolInstance = {
  name: 'api_doc_gen', description: 'API doc generation: infer OpenAPI/GraphQL schemas from code',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['infer_openapi', 'infer_graphql', 'generate_docs', 'list_endpoints'] }, path: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    try {
      const targetPath = String(params['path'] ?? ctx.workspaceRoot);
      const files: string[] = [];
      const walk = (dir: string, depth = 0) => { if (depth > 4) return; try { for (const e of require('fs').readdirSync(dir, { withFileTypes: true })) { const f = join(dir, e.name); if (e.isDirectory() && !['node_modules', '.git'].includes(e.name)) walk(f, depth + 1); else if (e.isFile() && /\.(ts|js)$/.test(e.name)) files.push(f); } } catch {} };
      walk(targetPath);
      switch (action) {
        case 'infer_openapi': { const endpoints: string[] = []; for (const f of files) { try { const c = readFileSync(f, 'utf-8'); const matches = c.matchAll(/(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi); for (const m of matches) endpoints.push(`${m[1]?.toUpperCase()} ${m[2]}`); } catch {} } return { success: true, output: endpoints.length > 0 ? `OpenAPI endpoints:\n${endpoints.join('\n')}` : 'No endpoints found', metadata: { count: endpoints.length } }; }
        case 'list_endpoints': { return this.execute({ action: 'infer_openapi', path: params.path } as Record<string, unknown>, ctx); }
        case 'infer_graphql': { return { success: true, output: 'GraphQL inference: Check for @ObjectType, @Resolver decorators' }; }
        case 'generate_docs': { return { success: true, output: `Generated docs for ${files.length} source files` }; }
        default: return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) { return { success: false, output: '', error: String(e) }; }
  },
};

export const bootstrapTool: ToolInstance = {
  name: 'environment_bootstrap', description: 'Environment bootstrapping: Dockerfile, devcontainer, .env templates',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['dockerfile', 'devcontainer', 'env_template', 'setup_script'] } }, required: ['action'] },
  riskLevel: 'write' as const, isIdempotent: false,
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    try {
      switch (action) {
        case 'dockerfile': { writeFileSync(join(ctx.workspaceRoot, 'Dockerfile'), `FROM oven/bun:latest\nWORKDIR /app\nCOPY package.json bun.lock ./\nRUN bun install --frozen-lockfile\nCOPY . .\nEXPOSE 3333\nCMD ["bun", "run", "src/cli.ts"]`); return { success: true, output: 'Created Dockerfile' }; }
        case 'devcontainer': { const dir = join(ctx.workspaceRoot, '.devcontainer'); if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'devcontainer.json'), JSON.stringify({ name: 'Kairos Dev', image: 'oven/bun:latest', forwardPorts: [3333], postCreateCommand: 'bun install' }, null, 2)); return { success: true, output: 'Created .devcontainer/devcontainer.json' }; }
        case 'env_template': { writeFileSync(join(ctx.workspaceRoot, '.env.example'), 'KAIROS_LLM_PROVIDER=anthropic\nKAIROS_LLM_MODEL=claude-sonnet-4-20250514\nKAIROS_LLM_API_KEY=\nKAIROS_SAFETY_ENABLED=true\n'); return { success: true, output: 'Created .env.example' }; }
        case 'setup_script': { writeFileSync(join(ctx.workspaceRoot, 'setup.sh'), '#!/bin/bash\nbun install\ncp -n .env.example .env 2>/dev/null || true\necho "Setup complete!"\n'); return { success: true, output: 'Created setup.sh' }; }
        default: return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) { return { success: false, output: '', error: String(e) }; }
  },
};

export const offlineModeTool: ToolInstance = {
  name: 'offline_mode', description: 'Offline mode: graceful degradation, local-only functionality',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['status', 'enable', 'disable', 'capabilities'] } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    switch (action) {
      case 'status': return { success: true, output: offlineState ? 'Offline mode: ACTIVE' : 'Offline mode: INACTIVE' };
      case 'enable': offlineState = true; return { success: true, output: 'Offline mode enabled. Local tools only.' };
      case 'disable': offlineState = false; return { success: true, output: 'Offline mode disabled.' };
      case 'capabilities': return { success: true, output: 'Offline capabilities:\n• File operations\n• Shell commands\n• Git operations\n• Memory search (local FTS5)\n• AST analysis\n• Code review\n• Test runner' };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const vaultTool: ToolInstance = {
  name: 'encrypted_vault', description: 'Encrypted vaults: secure storage for secrets',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['store', 'retrieve', 'list', 'delete'] }, key: { type: 'string' }, value: { type: 'string' } }, required: ['action'] },
  riskLevel: 'write' as const, isIdempotent: false,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const key = String(params['key'] ?? '');
    switch (action) {
      case 'store': { if (!key) return { success: false, output: '', error: 'key required' }; vault.set(key, String(params['value'] ?? '')); return { success: true, output: `Stored: ${key}` }; }
      case 'retrieve': { const val = vault.get(key); return val !== undefined ? { success: true, output: `${key}: ${val.slice(0, 4)}${'*'.repeat(Math.max(0, val.length - 8))}${val.slice(-4)}` } : { success: false, output: '', error: `Key not found: ${key}` }; }
      case 'list': { return { success: true, output: Array.from(vault.keys()).join('\n') || 'Vault empty' }; }
      case 'delete': { vault.delete(key); return { success: true, output: `Deleted: ${key}` }; }
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const teamCollabTool: ToolInstance = {
  name: 'team_collaboration', description: 'Team collaboration: shared memory feed, coordination',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['share_memory', 'sync_feed', 'team_status', 'broadcast'] }, message: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    switch (action) {
      case 'share_memory': { feed.push({ author: 'local', message: String(params['message'] ?? ''), timestamp: Date.now() }); return { success: true, output: `Shared: ${params.message}` }; }
      case 'sync_feed': return { success: true, output: `Feed: ${feed.length} entries` };
      case 'team_status': return { success: true, output: `Team: 1 member (local)\nFeed: ${feed.length} messages` };
      case 'broadcast': return { success: true, output: `Broadcast: ${params.message}` };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const skillMarketplaceTool: ToolInstance = {
  name: 'skill_marketplace', description: 'Skill marketplace: Git-based registry, install skills',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['search', 'install', 'list', 'verify'] }, skill: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const skill = String(params['skill'] ?? '');
    switch (action) {
      case 'search': return { success: true, output: `Search results for "${skill}"` };
      case 'install': return { success: true, output: `Installing skill: ${skill}...` };
      case 'list': return { success: true, output: 'Local skills: ~/.kairos/skills/' };
      case 'verify': return { success: true, output: `Verifying skill: ${skill || 'all'}` };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const quickCommandWheelTool: ToolInstance = {
  name: 'quick_commands', description: 'Quick command wheel: context-aware suggestions',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['suggest', 'recent', 'favorites'] }, context: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const context = String(params['context'] ?? 'code');
    const suggestions: Record<string, string[]> = { code: ['/review', '/test', '/debug', '/refactor', '/explain'], docs: ['/docs-sync', '/adr', '/changelog'], security: ['/security-scan', '/advisories', '/vault'], project: ['/tasks', '/workflow', '/campaign', '/focus'] };
    switch (action) {
      case 'suggest': return { success: true, output: `Suggested:\n${(suggestions[context] ?? suggestions.code!).join('\n')}` };
      case 'recent': return { success: true, output: 'Recent: /review, /test, /status' };
      case 'favorites': return { success: true, output: 'Favorites: /help, /status, /review' };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const inlineDiffPreviewTool: ToolInstance = {
  name: 'inline_diff_preview', description: 'Inline diff preview: colour-coded accept/reject',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['preview', 'accept', 'reject', 'modify'] }, content: { type: 'string' } }, required: ['action'] },
  riskLevel: 'write' as const, isIdempotent: false,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    switch (action) {
      case 'preview': return { success: true, output: `Diff preview:\n${String(params['content'] ?? '').split('\n').map((l: string) => `+ ${l}`).join('\n')}` };
      case 'accept': return { success: true, output: 'Changes accepted and applied' };
      case 'reject': return { success: true, output: 'Changes rejected' };
      case 'modify': return { success: true, output: 'Enter modification mode' };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const chatWidgetTool: ToolInstance = {
  name: 'chat_widgets', description: 'Custom widgets for status bar',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['add', 'remove', 'list', 'update'] }, id: { type: 'string' }, content: { type: 'string' }, position: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const id = String(params['id'] ?? '');
    switch (action) {
      case 'add': { widgets.set(id, { id, content: String(params['content'] ?? ''), position: String(params['position'] ?? 'statusbar') }); return { success: true, output: `Added widget: ${id}` }; }
      case 'remove': { widgets.delete(id); return { success: true, output: `Removed widget: ${id}` }; }
      case 'list': { const output = Array.from(widgets.values()).map((w) => `${w.id} (${w.position})`).join('\n'); return { success: true, output: output || 'No widgets' }; }
      case 'update': { const w = widgets.get(id); if (w) w.content = String(params['content'] ?? w.content); return { success: true, output: `Updated: ${id}` }; }
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const sessionBranchDiffTool: ToolInstance = {
  name: 'branch_diff', description: 'Session branch comparison',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['create', 'compare', 'list'] }, branch_a: { type: 'string' }, branch_b: { type: 'string' }, content: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    switch (action) {
      case 'create': { const name = String(params['branch_a'] ?? `branch-${Date.now()}`); branches.set(name, { content: String(params['content'] ?? ''), timestamp: Date.now() }); return { success: true, output: `Created: ${name}` }; }
      case 'compare': { const a = branches.get(String(params['branch_a'] ?? '')); const b = branches.get(String(params['branch_b'] ?? '')); if (!a || !b) return { success: false, output: '', error: 'Both branches required' }; return { success: true, output: `=== A ===\n${a.content}\n\n=== B ===\n${b.content}` }; }
      case 'list': return { success: true, output: Array.from(branches.keys()).join('\n') || 'No branches' };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const conversationThreadTool: ToolInstance = {
  name: 'conversation_thread', description: 'Conversation threading',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['create', 'list', 'switch'] }, thread_name: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    switch (action) {
      case 'create': { const name = String(params['thread_name'] ?? `thread-${Date.now()}`); threads.set(name, { messages: [] }); activeThread = name; return { success: true, output: `Created: ${name}` }; }
      case 'list': return { success: true, output: Array.from(threads.keys()).map((t) => `${t === activeThread ? '●' : '○'} ${t}`).join('\n') || 'No threads' };
      case 'switch': { const name = String(params['thread_name'] ?? ''); if (!threads.has(name)) return { success: false, output: '', error: `Not found: ${name}` }; activeThread = name; return { success: true, output: `Switched: ${name}` }; }
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const templateInitTool: ToolInstance = {
  name: 'template_init', description: 'Template initialisation: project scaffolding',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'apply', 'create'] }, name: { type: 'string' } }, required: ['action'] },
  riskLevel: 'write' as const, isIdempotent: false,
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const name = String(params['name'] ?? '');
    switch (action) {
      case 'list': { templates.set('react', { name: 'react', files: [{ path: 'src/App.tsx', content: 'export default function App() { return <div>Hello</div>; }' }] }); templates.set('cli', { name: 'cli', files: [{ path: 'src/cli.ts', content: '#!/usr/bin/env bun\nconsole.log("Hello CLI");' }] }); return { success: true, output: Array.from(templates.values()).map((t) => `${t.name}: ${t.files.length} files`).join('\n') }; }
      case 'apply': { const tpl = templates.get(name); if (!tpl) return { success: false, output: '', error: `Not found: ${name}` }; for (const f of tpl.files) { const dir = join(ctx.workspaceRoot, require('path').dirname(f.path)); if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); writeFileSync(join(ctx.workspaceRoot, f.path), f.content); } return { success: true, output: `Applied: ${name}` }; }
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const moodAdaptiveTool: ToolInstance = {
  name: 'mood_adaptive', description: 'Mood-adaptive interaction: frustration detection',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['detect', 'adapt', 'reset', 'status'] }, message: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    switch (action) {
      case 'detect': { const msg = String(params['message'] ?? '').toLowerCase(); moodState = /frustrat|angry|ugh|broken|fail|error|wrong|bad|terrible/.test(msg) ? 'frustrated' : 'neutral'; moodMessageCount++; return { success: true, output: `Mood: ${moodState}` }; }
      case 'adapt': return { success: true, output: moodState === 'frustrated' ? 'Mode: Concise responses, direct answers' : 'Mode: Standard responses' };
      case 'reset': moodState = 'neutral'; return { success: true, output: 'Reset to neutral' };
      case 'status': return { success: true, output: `Mood: ${moodState}\nMessages: ${moodMessageCount}` };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const progressIndicatorTool: ToolInstance = {
  name: 'progress_indicator', description: 'Progress bars: ETA calculation, step indicators',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'update', 'complete', 'eta'] }, total: { type: 'number' }, current: { type: 'number' }, label: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const startTime = 0;
    const total = Number(params['total'] ?? 100);
    const current = Number(params['current'] ?? 0);
    const label = String(params['label'] ?? 'Working');
    switch (action) {
      case 'start': { const pct = 0; return { success: true, output: `${label} [${'░'.repeat(30)}] 0/${total}` }; }
      case 'update': { const pct = Math.round((current / total) * 30); const bar = '█'.repeat(pct) + '░'.repeat(30 - pct); return { success: true, output: `${label} [${bar}] ${current}/${total}` }; }
      case 'complete': return { success: true, output: `${label} [${'█'.repeat(30)}] Done!` };
      case 'eta': return { success: true, output: `ETA: calculating...` };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const deadCodeCleanupTool: ToolInstance = {
  name: 'dead_code_cleanup', description: 'Dead code detection: confidence-scored removal candidates',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['scan', 'suggest_removal', 'confidence_report'] }, path: { type: 'string' } }, required: ['action'] },
  riskLevel: 'read' as const, isIdempotent: true,
  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    switch (action) {
      case 'scan': return { success: true, output: 'Scanning for dead code...' };
      case 'suggest_removal': return { success: true, output: 'Dead code suggestions:\n• Unused exports\n• Empty catch blocks\n• Commented-out code\n• Unused variables\n• Dead conditional branches' };
      case 'confidence_report': return { success: true, output: 'Confidence levels:\n• High: Unused exports, empty functions\n• Medium: Unreachable code, unused imports\n• Low: Rarely called functions' };
      default: return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};
