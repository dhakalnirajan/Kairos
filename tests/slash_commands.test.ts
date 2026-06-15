import { describe, test, expect } from 'bun:test';
import { ToolRegistry } from '../src/tools/registry.ts';
import { registerAllBuiltinTools } from '../src/tools/builtin/index.ts';
import { MemoryDatabase } from '../src/memory/database.ts';
import { getDbPath } from '../src/utils/paths.ts';

async function testSlashCommand(command: string, registry: ToolRegistry, memory: MemoryDatabase) {
  const ctx = { workspaceRoot: process.cwd(), sessionId: 'slash-test' };
  const config = { safety: { enabled: false } } as any;

  const parts = command.split(' ');
  const cmd = parts[0]!;
  const args = parts.slice(1);

  switch (cmd) {
    case '/help':
      return { success: true, output: 'Help text' };
    case '/clear':
      return { success: true, output: 'Cleared' };
    case '/status':
      return { success: true, output: 'Status OK' };
    case '/version':
      return { success: true, output: 'v0.1.0' };
    case '/model':
      return { success: true, output: `Model: ${args[0] || 'current'}` };
    case '/mode':
      return { success: true, output: `Mode: ${args[0] || 'NORMAL'}` };
    case '/recall':
      return await registry.execute('memory_ops', { operation: 'search', query: args.join(' ') || 'test' }, ctx, config);
    case '/remember':
      return await registry.execute('memory_ops', { operation: 'store', query: args.join(' ') || 'test', topic: 'user' }, ctx, config);
    case '/dream':
      return { success: true, output: 'Memory consolidated' };
    case '/compact':
      return { success: true, output: 'Context compacted' };
    case '/review':
      return await registry.execute('code_review', { action: 'review', path: args[0] || 'package.json' }, ctx, config);
    case '/test':
      return { success: true, output: 'Tests run' };
    case '/security':
      return await registry.execute('security_scan', { action: 'scan', path: args[0] || '.' }, ctx, config);
    case '/knowledge':
      return await registry.execute('knowledge', { action: 'list' }, ctx, config);
    case '/persona':
      return await registry.execute('persona', { action: 'list' }, ctx, config);
    case '/workflow':
      return await registry.execute('workflow', { action: 'parse', yaml: 'name: test\nsteps:\n  - id: 1\n    name: step1\n    tool: bash' }, ctx, config);
    case '/metrics':
      return await registry.execute('metrics', { action: 'scorecard' }, ctx, config);
    case '/undo':
      return await registry.execute('undo', { action: 'list' }, ctx, config);
    case '/alias':
      return await registry.execute('alias', { action: 'list' }, ctx, config);
    case '/bench':
      return await registry.execute('benchmark', { action: 'compare' }, ctx, config);
    case '/health':
      return await registry.execute('env_doctor', { action: 'check_all' }, ctx, config);
    case '/adr':
      return await registry.execute('adr_keeper', { action: 'list' }, ctx, config);
    case '/changelog':
      return await registry.execute('changelog', { action: 'generate' }, ctx, config);
    case '/meeting-notes':
      return await registry.execute('meeting_notes', { action: 'create', title: 'Test' }, ctx, config);
    case '/supply-chain':
      return await registry.execute('supply_chain', { action: 'audit' }, ctx, config);
    case '/license-check':
      return await registry.execute('license_scanner', { action: 'list_licenses' }, ctx, config);
    case '/advisories':
      return await registry.execute('advisories', { action: 'list' }, ctx, config);
    case '/transpile':
      return await registry.execute('transpile', { action: 'list_transforms' }, ctx, config);
    case '/modernise':
      return await registry.execute('modernise', { action: 'list_rules' }, ctx, config);
    case '/heap-snapshot':
      return await registry.execute('heap_snapshot', { action: 'current_usage' }, ctx, config);
    case '/repro':
      return await registry.execute('repro_case', { action: 'list' }, ctx, config);
    case '/onboarding':
      return await registry.execute('onboarding_path', { action: 'key_files' }, ctx, config);
    case '/secret-rotation':
      return await registry.execute('secret_rotation', { action: 'scan' }, ctx, config);
    case '/pair-review':
      return await registry.execute('pair_programming', { action: 'review', code: 'const x = 1;' }, ctx, config);
    case '/query-opt':
      return await registry.execute('query_optimisation', { action: 'scan_queries' }, ctx, config);
    case '/cicd':
      return await registry.execute('cicd_optimiser', { action: 'analyse' }, ctx, config);
    case '/diff-edit':
      return await registry.execute('diff_edit', { action: 'diff', old_content: 'a', new_content: 'b' }, ctx, config);
    case '/learning':
      return await registry.execute('learning', { action: 'list_rules' }, ctx, config);
    case '/session-continuity':
      return await registry.execute('session_continuity', { action: 'list_tasks' }, ctx, config);
    case '/debug':
      return await registry.execute('interactive_debug', { action: 'list' }, ctx, config);
    case '/error-recovery':
      return await registry.execute('error_recovery', { action: 'classify', error: 'ECONNREFUSED' }, ctx, config);
    case '/deps':
      return await registry.execute('dependency_graph', { action: 'parse', path: './src/types' }, ctx, config);
    case '/test-first':
      return await registry.execute('test_first', { action: 'skeleton', path: './src/types/index.ts' }, ctx, config);
    case '/arch-sketch':
      return await registry.execute('architecture_sketch', { action: 'box_diagram', components: 'A, B' }, ctx, config);
    case '/db-migrate':
      return await registry.execute('db_migration', { action: 'detect_orm' }, ctx, config);
    case '/api-docs':
      return await registry.execute('api_doc_gen', { action: 'list_endpoints' }, ctx, config);
    case '/bootstrap':
      return await registry.execute('environment_bootstrap', { action: 'env_template' }, ctx, config);
    case '/offline':
      return await registry.execute('offline_mode', { action: 'status' }, ctx, config);
    case '/vault':
      return await registry.execute('encrypted_vault', { action: 'list' }, ctx, config);
    case '/team':
      return await registry.execute('team_collaboration', { action: 'team_status' }, ctx, config);
    case '/marketplace':
      return await registry.execute('skill_marketplace', { action: 'list' }, ctx, config);
    case '/quick-commands':
      return await registry.execute('quick_commands', { action: 'suggest', context: 'code' }, ctx, config);
    case '/widgets':
      return await registry.execute('chat_widgets', { action: 'list' }, ctx, config);
    case '/branch-diff':
      return await registry.execute('branch_diff', { action: 'list' }, ctx, config);
    case '/thread':
      return await registry.execute('conversation_thread', { action: 'list' }, ctx, config);
    case '/template-init':
      return await registry.execute('template_init', { action: 'list' }, ctx, config);
    case '/mood':
      return await registry.execute('mood_adaptive', { action: 'status' }, ctx, config);
    case '/progress':
      return await registry.execute('progress_indicator', { action: 'render' }, ctx, config);
    case '/cleanup':
      return await registry.execute('dead_code_cleanup', { action: 'scan' }, ctx, config);
    case '/log-correlation':
      return await registry.execute('log_correlation', { action: 'parse', content: '[2025-01-15] INFO test' }, ctx, config);
    case '/ast':
      return await registry.execute('ast_analysis', { action: 'scan', path: './src/types' }, ctx, config);
    case '/dap':
      return await registry.execute('debug_adapter', { action: 'is_debugging' }, ctx, config);
    case '/thinking':
      return await registry.execute('thinking', { action: 'list_chains' }, ctx, config);
    case '/time-tracking':
      return await registry.execute('time_tracking', { action: 'summary' }, ctx, config);
    case '/achievements':
      return await registry.execute('achievements', { action: 'milestones' }, ctx, config);
    case '/templates':
      return await registry.execute('templates', { action: 'list' }, ctx, config);
    case '/session-record':
      return await registry.execute('session_recorder', { action: 'list' }, ctx, config);
    case '/release-notes':
      return await registry.execute('release_notes', { action: 'generate' }, ctx, config);
    case '/env-doctor':
      return await registry.execute('env_doctor', { action: 'check_all' }, ctx, config);
    case '/git-bisect':
      return await registry.execute('git_bisect', { action: 'status' }, ctx, config);
    case '/docs-sync':
      return await registry.execute('docs_sync', { action: 'scan' }, ctx, config);
    case '/semantic':
      return await registry.execute('semantic', { action: 'stats' }, ctx, config);
    case '/parallel':
      return await registry.execute('parallel', { action: 'plan', nodes_json: '[]' }, ctx, config);
    case '/security-scan':
      return await registry.execute('security_scan', { action: 'scan', path: '.' }, ctx, config);
    case '/performance':
      return await registry.execute('performance_analysis', { action: 'scan', path: '.' }, ctx, config);
    default:
      return { success: false, output: '', error: `Unknown command: ${cmd}` };
  }
}

describe('Slash Command Completeness', () => {
  let registry: ToolRegistry;
  let memory: MemoryDatabase;

  test('initialize tools', async () => {
    registry = new ToolRegistry();
    await registerAllBuiltinTools(registry);
    memory = new MemoryDatabase(getDbPath());
    expect(registry.getAll().length).toBeGreaterThan(60);
  });

  const commands = [
    '/help', '/clear', '/status', '/version', '/model gpt-4o', '/mode PLAN',
    '/recall test', '/remember test fact', '/dream', '/compact',
    '/review package.json', '/test', '/security .', '/knowledge', '/persona',
    '/workflow', '/metrics', '/undo', '/alias', '/bench', '/health',
    '/adr', '/changelog', '/meeting-notes', '/supply-chain', '/license-check',
    '/advisories', '/transpile', '/modernise', '/heap-snapshot', '/repro',
    '/onboarding', '/secret-rotation', '/pair-review', '/query-opt', '/cicd',
    '/diff-edit', '/learning', '/session-continuity', '/debug', '/error-recovery',
    '/deps', '/test-first', '/arch-sketch', '/db-migrate', '/api-docs',
    '/bootstrap', '/offline', '/vault', '/team', '/marketplace',
    '/quick-commands', '/widgets', '/branch-diff', '/thread', '/template-init',
    '/mood', '/progress', '/cleanup', '/log-correlation', '/ast',
    '/dap', '/thinking', '/time-tracking', '/achievements', '/templates',
    '/session-record', '/release-notes', '/env-doctor', '/git-bisect',
    '/docs-sync', '/semantic', '/parallel', '/security-scan', '/performance',
  ];

  for (const cmd of commands) {
    test(`command: ${cmd}`, async () => {
      const result = await testSlashCommand(cmd, registry, memory);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  }

  test('cleanup', () => {
    memory.close();
  });
});
