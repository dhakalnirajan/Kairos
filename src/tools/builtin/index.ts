import type { ToolRegistry } from '../registry.ts';
import type { ToolInstance } from '../../types/tools.ts';

type ToolLoader = () => Promise<Record<string, unknown>>;

const TOOL_LOADERS: Array<{ name: string; loader: ToolLoader; key: string }> = [
  {
    name: "read_file",
    loader: () => import("./read_file.ts"),
    key: "readFileTool",
  },
  {
    name: "write_file",
    loader: () => import("./write_file.ts"),
    key: "writeFileTool",
  },
  {
    name: "edit_file",
    loader: () => import("./edit_file.ts"),
    key: "editFileTool",
  },
  { name: "bash", loader: () => import("./bash.ts"), key: "bashTool" },
  { name: "git", loader: () => import("./git.ts"), key: "gitTool" },
  {
    name: "http_fetch",
    loader: () => import("./http_fetch.ts"),
    key: "httpFetchTool",
  },
  {
    name: "web_search",
    loader: () => import("./web_search.ts"),
    key: "webSearchTool",
  },
  {
    name: "memory_ops",
    loader: () => import("./memory_ops.ts"),
    key: "memoryOpsTool",
  },
  {
    name: "alias",
    loader: () => import("../alias.ts"),
    key: "aliasTool",
  },
  {
    name: "knowledge",
    loader: () => import("../knowledge.ts"),
    key: "knowledgeTool",
  },
  {
    name: "metrics",
    loader: () => import("../metrics.ts"),
    key: "metricsTool",
  },
  {
    name: "undo",
    loader: () => import("../undo.ts"),
    key: "undoTool",
  },
  {
    name: "workflow",
    loader: () => import("../workflow.ts"),
    key: "workflowTool",
  },
  { name: "glob", loader: () => import("./glob.ts"), key: "globTool" },
  { name: "grep", loader: () => import("./grep.ts"), key: "grepTool" },
  { name: "codemod", loader: () => import("./codemod.ts"), key: "codemodTool" },
  { name: "semantic", loader: () => import("../semantic.ts"), key: "semanticTool" },
  { name: "lsp", loader: () => import("../lsp.ts"), key: "lspTool" },
  { name: "persona", loader: () => import("../persona.ts"), key: "personaTool" },
  { name: "parallel", loader: () => import("../parallel.ts"), key: "parallelTool" },
  { name: "security_scan", loader: () => import("../security.ts"), key: "createSecurityTool" },
  { name: "performance_analysis", loader: () => import("../performance.ts"), key: "createPerformanceTool" },
  { name: "code_review", loader: () => import("../collaborative.ts"), key: "createCollaborativeTool" },
  { name: "ast_analysis", loader: () => import("./ast_tool.ts"), key: "astTool" },
  { name: "debug_adapter", loader: () => import("./dap_tool.ts"), key: "dapTool" },
  { name: "thinking", loader: () => import("./thinking_tool.ts"), key: "thinkingTool" },
  { name: "time_tracking", loader: () => import("./tracking_tool.ts"), key: "trackingTool" },
  { name: "progress", loader: () => import("./progress_tool.ts"), key: "progressTool" },
  { name: "advisories", loader: () => import("./advisories_tool.ts"), key: "advisoriesTool" },
  { name: "git_hooks", loader: () => import("./githooks_tool.ts"), key: "githooksTool" },
  { name: "achievements", loader: () => import("./achievements_tool.ts"), key: "achievementsTool" },
  { name: "templates", loader: () => import("./templates_tool.ts"), key: "templatesTool" },
  { name: "session_recorder", loader: () => import("./session_tool.ts"), key: "sessionTool" },
  { name: "release_notes", loader: () => import("./release_tool.ts"), key: "releaseNotesTool" },
  { name: "env_doctor", loader: () => import("./envdoctor_tool.ts"), key: "envDoctorTool" },
  { name: "git_bisect", loader: () => import("./bisect_tool.ts"), key: "bisectTool" },
  { name: "docs_sync", loader: () => import("./docsync_tool.ts"), key: "docsSyncTool" },
  { name: "adr_keeper", loader: () => import("./adr_tool.ts"), key: "adrTool" },
  { name: "supply_chain", loader: () => import("./supplychain_tool.ts"), key: "supplyChainTool" },
  { name: "transpile", loader: () => import("./transpiler_tool.ts"), key: "transpilerTool" },
  { name: "modernise", loader: () => import("./modernise_tool.ts"), key: "moderniseTool" },
  { name: "log_correlation", loader: () => import("./logcorrelation_tool.ts"), key: "logCorrelationTool" },
  { name: "heap_snapshot", loader: () => import("./heap_tool.ts"), key: "heapSnapshotTool" },
  { name: "repro_case", loader: () => import("./repro_tool.ts"), key: "reproCaseTool" },
  { name: "onboarding_path", loader: () => import("./onboarding_tool.ts"), key: "onboardingTool" },
  { name: "secret_rotation", loader: () => import("./secretrotation_tool.ts"), key: "secretRotationTool" },
  { name: "pair_programming", loader: () => import("./pairprogramming_tool.ts"), key: "pairProgrammingTool" },
  { name: "query_optimisation", loader: () => import("./queryopt_tool.ts"), key: "queryOptTool" },
  { name: "cicd_optimiser", loader: () => import("./cicd_tool.ts"), key: "cicdTool" },
  { name: "smart_compaction", loader: () => import("./compaction_tool.ts"), key: "compactionTool" },
  { name: "diff_edit", loader: () => import("./diffedit_tool.ts"), key: "diffEditTool" },
  { name: "learning", loader: () => import("./learning_tool.ts"), key: "learningTool" },
  { name: "session_continuity", loader: () => import("./continuity_tool.ts"), key: "sessionContinuityTool" },
  { name: "live_streaming", loader: () => import("./livestream_tool.ts"), key: "liveStreamingTool" },
  { name: "interactive_debug", loader: () => import("./interactivedebug_tool.ts"), key: "interactiveDebugTool" },
  { name: "error_recovery", loader: () => import("./errorrecovery_tool.ts"), key: "errorRecoveryTool" },
  { name: "dependency_graph", loader: () => import("./dependencygraph_tool.ts"), key: "dependencyGraphTool" },
  { name: "test_first", loader: () => import("./testfirst_tool.ts"), key: "testFirstTool" },
  { name: "architecture_sketch", loader: () => import("./archsketch_tool.ts"), key: "archSketchTool" },
  { name: "meeting_notes", loader: () => import("./meetingnotes_tool.ts"), key: "meetingNotesTool" },
  { name: "changelog", loader: () => import("./changelog_tool.ts"), key: "changelogTool" },
  { name: "license_scanner", loader: () => import("./licensescanner_tool.ts"), key: "licenseScannerTool" },
  { name: "benchmark", loader: () => import("./benchmark_tool.ts"), key: "benchmarkTool" },
  { name: "db_migration", loader: () => import("./ux_toolkit.ts"), key: "dbMigrationTool" },
  { name: "api_doc_gen", loader: () => import("./ux_toolkit.ts"), key: "apiDocGenTool" },
  { name: "environment_bootstrap", loader: () => import("./ux_toolkit.ts"), key: "bootstrapTool" },
  { name: "offline_mode", loader: () => import("./ux_toolkit.ts"), key: "offlineModeTool" },
  { name: "encrypted_vault", loader: () => import("./ux_toolkit.ts"), key: "vaultTool" },
  { name: "team_collaboration", loader: () => import("./ux_toolkit.ts"), key: "teamCollabTool" },
  { name: "skill_marketplace", loader: () => import("./ux_toolkit.ts"), key: "skillMarketplaceTool" },
  { name: "quick_commands", loader: () => import("./ux_toolkit.ts"), key: "quickCommandWheelTool" },
  { name: "inline_diff_preview", loader: () => import("./ux_toolkit.ts"), key: "inlineDiffPreviewTool" },
  { name: "chat_widgets", loader: () => import("./ux_toolkit.ts"), key: "chatWidgetTool" },
  { name: "branch_diff", loader: () => import("./ux_toolkit.ts"), key: "sessionBranchDiffTool" },
  { name: "conversation_thread", loader: () => import("./ux_toolkit.ts"), key: "conversationThreadTool" },
  { name: "template_init", loader: () => import("./ux_toolkit.ts"), key: "templateInitTool" },
  { name: "mood_adaptive", loader: () => import("./ux_toolkit.ts"), key: "moodAdaptiveTool" },
  { name: "progress_indicator", loader: () => import("./ux_toolkit.ts"), key: "progressIndicatorTool" },
  { name: "dead_code_cleanup", loader: () => import("./ux_toolkit.ts"), key: "deadCodeCleanupTool" },
];

export async function registerAllBuiltinTools(registry: ToolRegistry): Promise<void> {
  const tools = await Promise.all(
    TOOL_LOADERS.map(async (entry) => {
      const mod = await entry.loader();
      const toolOrFn = mod[entry.key];
      if (typeof toolOrFn === 'function') {
        return toolOrFn() as ToolInstance;
      }
      return toolOrFn as ToolInstance;
    }),
  );
  for (const tool of tools) {
    if (tool) registry.register(tool);
  }
}
