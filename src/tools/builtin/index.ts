import type { ToolRegistry } from '../registry.ts';
import type { ToolInstance } from '../../types/tools.ts';

type ToolLoader = () => Promise<Record<string, ToolInstance>>;

const TOOL_LOADERS: Array<{ name: string; loader: ToolLoader; key: string }> = [
  { name: 'read_file', loader: () => import('./read_file.ts'), key: 'readFileTool' },
  { name: 'write_file', loader: () => import('./write_file.ts'), key: 'writeFileTool' },
  { name: 'edit_file', loader: () => import('./edit_file.ts'), key: 'editFileTool' },
  { name: 'bash', loader: () => import('./bash.ts'), key: 'bashTool' },
  { name: 'git', loader: () => import('./git.ts'), key: 'gitTool' },
  { name: 'http_fetch', loader: () => import('./http_fetch.ts'), key: 'httpFetchTool' },
  { name: 'web_search', loader: () => import('./web_search.ts'), key: 'webSearchTool' },
  { name: 'memory_ops', loader: () => import('./memory_ops.ts'), key: 'memoryOpsTool' },
  { name: 'glob', loader: () => import('./glob.ts'), key: 'globTool' },
  { name: 'grep', loader: () => import('./grep.ts'), key: 'grepTool' },
];

export async function registerAllBuiltinTools(registry: ToolRegistry): Promise<void> {
  const tools = await Promise.all(
    TOOL_LOADERS.map(async (entry) => {
      const mod = await entry.loader();
      return mod[entry.key] as ToolInstance;
    }),
  );
  for (const tool of tools) {
    if (tool) registry.register(tool);
  }
}

export { readFileTool } from './read_file.ts';
export { writeFileTool } from './write_file.ts';
export { editFileTool } from './edit_file.ts';
export { bashTool } from './bash.ts';
export { gitTool } from './git.ts';
export { httpFetchTool } from './http_fetch.ts';
export { webSearchTool } from './web_search.ts';
export { memoryOpsTool } from './memory_ops.ts';
export { globTool } from './glob.ts';
export { grepTool } from './grep.ts';
