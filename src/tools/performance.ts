import { readFileSync, statSync } from 'fs';
import { extname } from 'path';

export interface BundleMetric {
  file: string;
  size: number;
  gzipSize: number;
  lines: number;
  complexity: number;
}

export interface PerformanceIssue {
  file: string;
  line: number;
  type: 'bundle' | 'runtime' | 'pattern';
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  impact: string;
}

export interface OptimizationSuggestion {
  category: string;
  description: string;
  files: string[];
  estimatedImprovement: string;
  priority: number;
}

export class PerformanceAnalyzer {
  analyzeBundleSize(files: Map<string, string>): BundleMetric[] {
    const metrics: BundleMetric[] = [];

    for (const [file, content] of files) {
      const size = Buffer.byteLength(content, 'utf-8');
      const lines = content.split('\n').length;
      const complexity = this.estimateComplexity(content);

      metrics.push({
        file,
        size,
        gzipSize: Math.round(size * 0.3),
        lines,
        complexity,
      });
    }

    return metrics.sort((a, b) => b.size - a.size);
  }

  private estimateComplexity(content: string): number {
    let complexity = 0;

    complexity += (content.match(/function\s/g) || []).length;
    complexity += (content.match(/=>\s*{/g) || []).length;
    complexity += (content.match(/class\s/g) || []).length;
    complexity += (content.match(/if\s*\(/g) || []).length;
    complexity += (content.match(/for\s*\(/g) || []).length;
    complexity += (content.match(/while\s*\(/g) || []).length;
    complexity += (content.match(/switch\s*\(/g) || []).length;

    return complexity;
  }

  analyzePatterns(files: Map<string, string>): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    const patterns = [
      {
        pattern: /console\.(log|debug|info|warn|error)\s*\(/g,
        type: 'runtime' as const,
        message: 'Console statement in production code',
        suggestion: 'Remove or guard with debug flag',
        impact: 'Minor performance overhead',
        severity: 'low' as const,
      },
      {
        pattern: /new\s+RegExp\s*\(/g,
        type: 'runtime' as const,
        message: 'Dynamic RegExp creation in hot path',
        suggestion: 'Cache compiled RegExp',
        impact: 'Potential memory leak',
        severity: 'medium' as const,
      },
      {
        pattern: /JSON\.(parse|stringify)\s*\(/g,
        type: 'runtime' as const,
        message: 'JSON serialization in potential hot path',
        suggestion: 'Consider caching or streaming for large objects',
        impact: 'CPU overhead on large payloads',
        severity: 'medium' as const,
      },
      {
        pattern: /(?:import|require)\s*\([^)]*\)/g,
        type: 'bundle' as const,
        message: 'Dynamic import detected',
        suggestion: 'Verify lazy loading is intentional',
        impact: 'Code splitting behavior',
        severity: 'low' as const,
      },
      {
        pattern: /async\s+function|new\s+Promise/g,
        type: 'runtime' as const,
        message: 'Async operation - check for proper error handling',
        suggestion: 'Ensure errors are caught and handled',
        impact: 'Unhandled rejections',
        severity: 'low' as const,
      },
    ];

    for (const [file, content] of files) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        for (const p of patterns) {
          const matches = line.matchAll(p.pattern);
          for (const match of matches) {
            if (match.index !== undefined) {
              issues.push({
                file,
                line: i + 1,
                type: p.type,
                severity: p.severity,
                message: p.message,
                suggestion: p.suggestion,
                impact: p.impact,
              });
            }
          }
        }
      }
    }

    return issues;
  }

  suggestOptimizations(
    metrics: BundleMetric[],
    issues: PerformanceIssue[],
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    const largeFiles = metrics.filter((m) => m.size > 50000);
    if (largeFiles.length > 0) {
      suggestions.push({
        category: 'Bundle Size',
        description: 'Large files detected - consider code splitting',
        files: largeFiles.map((m) => m.file),
        estimatedImprovement: `${Math.round(largeFiles.reduce((a, m) => a + m.size, 0) / 1024)}KB reducible`,
        priority: 1,
      });
    }

    const highComplexityFiles = metrics.filter((m) => m.complexity > 50);
    if (highComplexityFiles.length > 0) {
      suggestions.push({
        category: 'Complexity',
        description: 'High complexity files - consider refactoring',
        files: highComplexityFiles.map((m) => m.file),
        estimatedImprovement: 'Improved maintainability and testability',
        priority: 2,
      });
    }

    const consoleIssues = issues.filter((i) => i.message.includes('Console statement'));
    if (consoleIssues.length > 0) {
      suggestions.push({
        category: 'Cleanup',
        description: 'Remove console statements for production',
        files: [...new Set(consoleIssues.map((i) => i.file))],
        estimatedImprovement: 'Reduced noise and minor performance gain',
        priority: 3,
      });
    }

    const jsonIssues = issues.filter((i) => i.message.includes('JSON serialization'));
    if (jsonIssues.length > 0) {
      suggestions.push({
        category: 'Runtime',
        description: 'Optimize JSON operations in hot paths',
        files: [...new Set(jsonIssues.map((i) => i.file))],
        estimatedImprovement: 'Reduced CPU usage on large payloads',
        priority: 2,
      });
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  generateReport(
    metrics: BundleMetric[],
    issues: PerformanceIssue[],
    suggestions: OptimizationSuggestion[],
  ): string {
    const totalSize = metrics.reduce((a, m) => a + m.size, 0);
    const totalLines = metrics.reduce((a, m) => a + m.lines, 0);

    const lines = [
      'Performance Analysis Report',
      '===========================',
      '',
      'Bundle Overview:',
      `  Total size: ${Math.round(totalSize / 1024)}KB`,
      `  Total lines: ${totalLines}`,
      `  Files analyzed: ${metrics.length}`,
      '',
      'Issues Found:',
      `  High: ${issues.filter((i) => i.severity === 'high').length}`,
      `  Medium: ${issues.filter((i) => i.severity === 'medium').length}`,
      `  Low: ${issues.filter((i) => i.severity === 'low').length}`,
      '',
    ];

    if (suggestions.length > 0) {
      lines.push('Optimization Suggestions:');
      for (const s of suggestions) {
        lines.push(`  [${s.category}] ${s.description}`);
        lines.push(`    Files: ${s.files.length}`);
        lines.push(`    Impact: ${s.estimatedImprovement}`);
        lines.push('');
      }
    }

    if (metrics.length > 0) {
      lines.push('Largest Files:');
      for (const m of metrics.slice(0, 5)) {
        lines.push(`  ${m.file}: ${Math.round(m.size / 1024)}KB (${m.lines} lines)`);
      }
    }

    return lines.join('\n');
  }
}

export function createPerformanceTool() {
  return {
    name: 'performance_analysis',
    description: 'Analyze code for performance issues, bundle size, and optimization opportunities',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory or file to analyze' },
        analysisType: {
          type: 'string',
          enum: ['bundle', 'patterns', 'full'],
          description: 'Type of analysis to perform',
        },
      },
      required: ['path'],
    },
    riskLevel: 'read' as const,
    isIdempotent: true,
    execute: async (params: Record<string, unknown>, ctx: { workspaceRoot: string }) => {
      const path = params.path as string;
      const analysisType = (params.analysisType as string) ?? 'full';

      const analyzer = new PerformanceAnalyzer();
      const files = new Map<string, string>();

      try {
        const { readdirSync } = await import('fs');
        const { join } = await import('path');

        const collectFiles = (dir: string, depth = 0) => {
          if (depth > 10) return;
          try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
              if (entry.startsWith('.') || entry === 'node_modules') continue;
              const fullPath = join(dir, entry);
              const stat = statSync(fullPath);
              if (stat.isDirectory()) {
                collectFiles(fullPath, depth + 1);
              } else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry))) {
                try {
                  files.set(fullPath, readFileSync(fullPath, 'utf-8'));
                } catch {}
              }
            }
          } catch {}
        };

        collectFiles(path);

        const metrics = analysisType === 'bundle' || analysisType === 'full'
          ? analyzer.analyzeBundleSize(files)
          : [];

        const issues = analysisType === 'patterns' || analysisType === 'full'
          ? analyzer.analyzePatterns(files)
          : [];

        const suggestions = analyzer.suggestOptimizations(metrics, issues);
        const report = analyzer.generateReport(metrics, issues, suggestions);

        return {
          success: true,
          output: report,
          metadata: {
            metrics,
            issues,
            suggestions,
            summary: {
              filesAnalyzed: files.size,
              totalSize: metrics.reduce((a, m) => a + m.size, 0),
              issuesFound: issues.length,
              suggestionsCount: suggestions.length,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
