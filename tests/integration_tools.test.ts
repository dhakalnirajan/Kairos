import { ToolRegistry } from '../src/tools/registry.ts';
import { registerAllBuiltinTools } from '../src/tools/builtin/index.ts';
import { MemoryDatabase } from '../src/memory/database.ts';
import { getDbPath } from '../src/utils/paths.ts';

async function testAllTools() {
  const registry = new ToolRegistry();
  await registerAllBuiltinTools(registry);

  const memory = new MemoryDatabase(getDbPath());
  const ctx = { workspaceRoot: process.cwd(), sessionId: 'integration-test' };
  const config = { safety: { enabled: false } } as any;

  const tools: Array<[string, Record<string, unknown>]> = [
    ['read_file', { path: 'package.json' }],
    ['write_file', { path: '.test-tmp', content: 'test' }],
    ['bash', { command: 'echo test' }],
    ['glob', { pattern: '*.ts' }],
    ['grep', { pattern: 'export' }],
    ['git', { operation: 'status' }],
    ['memory_ops', { operation: 'store', query: 'test fact', topic: 'test' }],
    ['knowledge', { action: 'add', subject: 'A', predicate: 'relates', object: 'B' }],
    ['alias', { action: 'add', name: 'test', expansion: 'hello' }],
    ['metrics', { action: 'define', metric: 'test', warning: 10, critical: 20 }],
    ['undo', { action: 'list' }],
    ['workflow', { action: 'parse', yaml: 'name: test\nsteps:\n  - id: 1\n    name: step1\n    tool: bash' }],
    ['semantic', { action: 'add', id: '1', text: 'test', embedding_json: '[0.1,0.2,0.3]' }],
    ['persona', { action: 'list' }],
    ['ast_analysis', { action: 'scan', path: './src/types' }],
    ['thinking', { action: 'start_chain' }],
    ['time_tracking', { action: 'start', action_name: 'test' }],
    ['progress', { action: 'create', progress_id: 'p1' }],
    ['achievements', { action: 'milestones' }],
    ['templates', { action: 'list' }],
    ['session_recorder', { action: 'start', session_id: 's1' }],
    ['release_notes', { action: 'generate' }],
    ['env_doctor', { action: 'check_all' }],
    ['docs_sync', { action: 'scan' }],
    ['adr_keeper', { action: 'list' }],
    ['supply_chain', { action: 'audit' }],
    ['transpile', { action: 'list_transforms' }],
    ['modernise', { action: 'list_rules' }],
    ['log_correlation', { action: 'parse', content: '[2025-01-15] INFO test message' }],
    ['heap_snapshot', { action: 'current_usage' }],
    ['repro_case', { action: 'list' }],
    ['onboarding_path', { action: 'key_files' }],
    ['secret_rotation', { action: 'scan' }],  // success=false when secrets found is expected
    ['pair_programming', { action: 'review', code: 'const x = 1;' }],
    ['query_optimisation', { action: 'scan_queries' }],
    ['cicd_optimiser', { action: 'analyse' }],
    ['smart_compaction', { action: 'stats' }],
    ['diff_edit', { action: 'diff', old_content: 'a\nb', new_content: 'a\nc' }],
    ['learning', { action: 'add_rule', pattern: 'test', replacement: 'replaced' }],
    ['session_continuity', { action: 'add_task', task: 'test task' }],
    ['interactive_debug', { action: 'add_hypothesis', hypothesis: 'test hypothesis' }],
    ['error_recovery', { action: 'classify', error: 'ECONNREFUSED' }],
    ['dependency_graph', { action: 'parse', path: './src/types' }],
    ['test_first', { action: 'skeleton', path: './src/types/index.ts' }],
    ['architecture_sketch', { action: 'box_diagram', components: 'A, B, C' }],
    ['meeting_notes', { action: 'create', title: 'Test Meeting' }],
    ['changelog', { action: 'generate' }],
    ['license_scanner', { action: 'list_licenses' }],
    ['benchmark', { action: 'start', name: 'test' }],
    ['db_migration', { action: 'detect_orm' }],
    ['api_doc_gen', { action: 'list_endpoints' }],
    ['environment_bootstrap', { action: 'env_template' }],
    ['offline_mode', { action: 'status' }],
    ['encrypted_vault', { action: 'store', key: 'k', value: 'v' }],
    ['team_collaboration', { action: 'team_status' }],
    ['skill_marketplace', { action: 'list' }],
    ['quick_commands', { action: 'suggest', context: 'code' }],
    ['inline_diff_preview', { action: 'preview', content: 'test' }],
    ['chat_widgets', { action: 'add', id: 'w1', content: 'test' }],
    ['branch_diff', { action: 'create', branch_a: 'b1', content: 'test' }],
    ['conversation_thread', { action: 'create', thread_name: 't1' }],
    ['template_init', { action: 'list' }],
    ['mood_adaptive', { action: 'detect', message: 'this is frustrating' }],
    ['progress_indicator', { action: 'start', total: 100, label: 'test' }],
    ['dead_code_cleanup', { action: 'scan' }],
    ['advisories', { action: 'list' }],
  ];

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const [tool, params] of tools) {
    try {
      const result = await registry.execute(tool, params, ctx, config);
      // secret_rotation returns success=false when secrets found (expected)
      if (result.success || (tool === 'secret_rotation' && result.metadata)) {
        passed++;
      } else {
        failed++;
        failures.push(`${tool}: ${result.error}`);
      }
    } catch (e) {
      failed++;
      failures.push(`${tool}: ${e}`);
    }
  }

  memory.close();
  try { require('fs').unlinkSync('.test-tmp'); } catch {}

  console.log(`\nResults: ${passed} pass, ${failed} fail out of ${tools.length} tools`);
  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

testAllTools();
