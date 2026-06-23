import type { ToolRegistry } from '../registry.ts';
import type { ToolInstance } from '../../types/tools.ts';

type ToolLoader = () => Promise<Record<string, unknown>>;

const TOOL_LOADERS: Array<{ name: string; loader: ToolLoader; key: string }> = [
  // File tools
  { name: "read_file", loader: () => import("./file/read_file.ts"), key: "readFileTool" },
  { name: "write_file", loader: () => import("./file/write_file.ts"), key: "writeFileTool" },
  { name: "edit_file", loader: () => import("./file/edit_file.ts"), key: "editFileTool" },
  { name: "glob", loader: () => import("./file/glob.ts"), key: "globTool" },
  { name: "grep", loader: () => import("./file/grep.ts"), key: "grepTool" },
  // Shell tools
  { name: "bash", loader: () => import("./shell/bash.ts"), key: "bashTool" },
  { name: "git", loader: () => import("./shell/git.ts"), key: "gitTool" },
  // Web tools
  { name: "http_fetch", loader: () => import("./web/http_fetch.ts"), key: "httpFetchTool" },
  { name: "web_search", loader: () => import("./web/web_search.ts"), key: "webSearchTool" },
  // Memory tools
  { name: "memory_ops", loader: () => import("./memory/memory_ops.ts"), key: "memoryOpsTool" },
  // Analysis tools
  { name: "ast_analysis", loader: () => import("./ast_tool.ts"), key: "astTool" },
  { name: "codemod", loader: () => import("../analysis/codemod.ts"), key: "codemodTool" },
  { name: "semantic", loader: () => import("../analysis/semantic.ts"), key: "semanticTool" },
  { name: "security_scan", loader: () => import("../analysis/security.ts"), key: "createSecurityTool" },
  { name: "performance_analysis", loader: () => import("../analysis/performance.ts"), key: "createPerformanceTool" },
  { name: "code_review", loader: () => import("../analysis/collaborative.ts"), key: "createCollaborativeTool" },
  { name: "knowledge", loader: () => import("../analysis/knowledge.ts"), key: "knowledgeTool" },
  // Session tools
  { name: "session_recorder", loader: () => import("./session_tool.ts"), key: "sessionTool" },
  { name: "undo", loader: () => import("../session/undo.ts"), key: "undoTool" },
  { name: "achievements", loader: () => import("./achievements_tool.ts"), key: "achievementsTool" },
  { name: "alias", loader: () => import("../session/alias.ts"), key: "aliasTool" },
  { name: "analytics", loader: () => import("../session/analytics.ts"), key: "analyticsTool" },
  { name: "progress", loader: () => import("./progress_tool.ts"), key: "progressTool" },
  { name: "tracking", loader: () => import("./tracking_tool.ts"), key: "trackingTool" },
  { name: "session_continuity", loader: () => import("./continuity_tool.ts"), key: "sessionContinuityTool" },
  // Workflow tools
  { name: "workflow", loader: () => import("../workflow/workflow.ts"), key: "workflowTool" },
  { name: "parallel", loader: () => import("../workflow/parallel.ts"), key: "parallelTool" },
  { name: "templates", loader: () => import("./templates_tool.ts"), key: "templatesTool" },
  { name: "metrics", loader: () => import("../workflow/metrics.ts"), key: "metricsTool" },
  { name: "learning", loader: () => import("./learning_tool.ts"), key: "learningTool" },
  // UX tools
  { name: "thinking", loader: () => import("./thinking_tool.ts"), key: "thinkingTool" },
  { name: "persona", loader: () => import("../ux/persona.ts"), key: "personaTool" },
  { name: "lsp", loader: () => import("../ux/lsp.ts"), key: "lspTool" },
  { name: "debug_adapter", loader: () => import("./dap_tool.ts"), key: "dapTool" },
  { name: "widgets", loader: () => import("../ux/widgets.ts"), key: "widgetTool" },
  { name: "interactive_debug", loader: () => import("./interactivedebug_tool.ts"), key: "interactiveDebugTool" },
  { name: "error_recovery", loader: () => import("./errorrecovery_tool.ts"), key: "errorRecoveryTool" },
  { name: "test_first", loader: () => import("./testfirst_tool.ts"), key: "testFirstTool" },
  { name: "repro_case", loader: () => import("./repro_tool.ts"), key: "reproCaseTool" },
  { name: "log_correlation", loader: () => import("./logcorrelation_tool.ts"), key: "logCorrelationTool" },
  // DevOps tools
  { name: "git_hooks", loader: () => import("./githooks_tool.ts"), key: "githooksTool" },
  { name: "advisories", loader: () => import("./advisories_tool.ts"), key: "advisoriesTool" },
  { name: "git_bisect", loader: () => import("./bisect_tool.ts"), key: "bisectTool" },
  { name: "cicd_optimiser", loader: () => import("./cicd_tool.ts"), key: "cicdTool" },
  { name: "env_doctor", loader: () => import("./envdoctor_tool.ts"), key: "envDoctorTool" },
  { name: "secret_rotation", loader: () => import("./secretrotation_tool.ts"), key: "secretRotationTool" },
  { name: "supply_chain", loader: () => import("./supplychain_tool.ts"), key: "supplyChainTool" },
  { name: "query_optimisation", loader: () => import("./queryopt_tool.ts"), key: "queryOptTool" },
  { name: "release_notes", loader: () => import("./release_tool.ts"), key: "releaseNotesTool" },
  { name: "benchmark", loader: () => import("./benchmark_tool.ts"), key: "benchmarkTool" },
  { name: "transpile", loader: () => import("./transpiler_tool.ts"), key: "transpilerTool" },
  { name: "modernise", loader: () => import("./modernise_tool.ts"), key: "moderniseTool" },
  // Documentation tools
  { name: "adr_keeper", loader: () => import("./adr_tool.ts"), key: "adrTool" },
  { name: "docs_sync", loader: () => import("./docsync_tool.ts"), key: "docsSyncTool" },
  { name: "meeting_notes", loader: () => import("./meetingnotes_tool.ts"), key: "meetingNotesTool" },
  { name: "changelog", loader: () => import("./changelog_tool.ts"), key: "changelogTool" },
  { name: "license_scanner", loader: () => import("./licensescanner_tool.ts"), key: "licenseScannerTool" },
  { name: "onboarding_path", loader: () => import("./onboarding_tool.ts"), key: "onboardingTool" },
  { name: "architecture_sketch", loader: () => import("./archsketch_tool.ts"), key: "archSketchTool" },
  // Additional tools
  { name: "heap_snapshot", loader: () => import("./heap_tool.ts"), key: "heapSnapshotTool" },
  { name: "dependency_graph", loader: () => import("./dependencygraph_tool.ts"), key: "dependencyGraphTool" },
  { name: "diff_edit", loader: () => import("./diffedit_tool.ts"), key: "diffEditTool" },
  { name: "smart_compaction", loader: () => import("./compaction_tool.ts"), key: "compactionTool" },
  { name: "live_streaming", loader: () => import("./livestream_tool.ts"), key: "liveStreamingTool" },
  { name: "pair_programming", loader: () => import("./pairprogramming_tool.ts"), key: "pairProgrammingTool" },
  // UX toolkit tools
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
  // Skill runner tool
  { name: "skill_runner", loader: () => import("./skill_runner_tool.ts"), key: "skillRunnerTool" },
];

export function registerAllBuiltinTools(registry: ToolRegistry): Promise<void> {
  return Promise.all(
    TOOL_LOADERS.map(async (loader) => {
      try {
        const mod = await loader.loader();
        const tool = mod[loader.key];
        if (tool && typeof tool === 'object' && 'name' in tool) {
          registry.register(tool as ToolInstance);
        } else if (typeof tool === 'function') {
          const instance = tool();
          if (instance && typeof instance === 'object' && 'name' in instance) {
            registry.register(instance as ToolInstance);
          }
        }
      } catch (e) {
        console.error(`Failed to load tool ${loader.name}:`, e);
      }
    })
  ).then(() => {});
}
