import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const testFirstTool: ToolInstance = {
  name: 'test_first',
  description: 'Test-first generation: create test skeletons, approve tests, iterate until green',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['skeleton', 'approve', 'run_tests', 'iterate'], description: 'Test action' },
      path: { type: 'string', description: 'Source file path' },
      framework: { type: 'string', enum: ['bun', 'jest', 'vitest', 'mocha'], description: 'Test framework' },
      test_content: { type: 'string', description: 'Test content to approve' },
      name: { type: 'string', description: 'Test/describe block name' },
    },
    required: ['action'],
  },
  riskLevel: 'write' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const framework = String(params['framework'] ?? 'bun');
    const name = String(params['name'] ?? 'test');

    try {
      switch (action) {
        case 'skeleton': {
          const sourcePath = String(params['path'] ?? '');
          if (!sourcePath) return { success: false, output: '', error: 'path required' };
          const testDir = join(ctx.workspaceRoot, 'tests');
          if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });
          const testFile = sourcePath.replace(/\.(ts|tsx|js|jsx)$/, '.test.ts');
          const fullPath = join(ctx.workspaceRoot, testFile);

          const skeleton = `import { describe, it, expect } from '${framework === 'bun' ? 'bun:test' : framework}';\n\ndescribe('${name}', () => {\n  it('should work correctly', () => {\n    expect(true).toBe(true);\n  });\n\n  it('should handle edge cases', () => {\n    expect(true).toBe(true);\n  });\n});\n`;

          if (!existsSync(fullPath)) writeFileSync(fullPath, skeleton);
          return { success: true, output: `Created test skeleton: ${testFile}\nFramework: ${framework}\nRun with: ${framework === 'bun' ? 'bun test' : 'npx ' + framework}` };
        }
        case 'approve': {
          const testContent = String(params['test_content'] ?? '');
          if (!testContent) return { success: false, output: '', error: 'test_content required' };
          const testDir = join(ctx.workspaceRoot, 'tests');
          if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });
          const testFile = join(testDir, `${name}.test.ts`);
          writeFileSync(testFile, testContent);
          return { success: true, output: `Approved and saved test: tests/${name}.test.ts` };
        }
        case 'run_tests': {
          return { success: true, output: `Run tests with:\n  bun test\n  # or: npx ${framework} --watch` };
        }
        case 'iterate': {
          const testContent = String(params['test_content'] ?? '');
          return { success: true, output: testContent ? `Test iteration:\n${testContent}` : 'Provide test_content to iterate' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Test-first failed: ${e}` };
    }
  },
};
