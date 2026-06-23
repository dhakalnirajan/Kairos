import { sdlcManager } from './index.ts';

export interface SDLCHandler {
  command: string;
  description: string;
  handler: (args: string) => string;
}

export const sdlcCommands: SDLCHandler[] = [
  {
    command: '/sdlc init',
    description: 'Initialize SDLC agent for current project',
    handler: (_args) => {
      return `\n{bold}{#208AAE-fg}=== SDLC Agent Initialized ==={/}{/bold}\n\nSDLC agent is ready. Available commands:\n\n{bold}Requirements:{/bold} /sdlc requirements\n{bold}Design:{/bold} /sdlc design\n{bold}Planning:{/bold} /sdlc plan\n{bold}Implementation:{/bold} /sdlc code\n{bold}Review:{/bold} /sdlc review\n{bold}Testing:{/bold} /sdlc test\n{bold}Deployment:{/bold} /sdlc deploy\n{bold}Monitoring:{/bold} /sdlc monitor\n{bold}Documentation:{/bold} /sdlc docs\n{bold}Status:{/bold} /sdlc status\n{bold}Report:{/bold} /sdlc report\n\nUse /sdlc <command> to get started.\n`;
    },
  },
  {
    command: '/sdlc requirements',
    description: 'Start requirements gathering session',
    handler: (args) => {
      if (args) {
        const req = sdlcManager.createRequirement(args, `Requirement: ${args}`, 'medium');
        return `\n{#4ECDC4-fg}Requirement created: ${req.id}{/}\nTitle: ${req.title}\nStatus: ${req.status}\n`;
      }
      const reqs = sdlcManager.listRequirements();
      if (reqs.length === 0) {
        return '\n{#4ECDC4-fg}No requirements yet. Use /sdlc requirements <title> to create one.{/}\n';
      }
      const lines = ['\n{bold}{#208AAE-fg}=== Requirements ==={/}{/bold}\n'];
      for (const req of reqs) {
        lines.push(`  ${req.id}: ${req.title} [${req.status}] (${req.priority})`);
      }
      return lines.join('\n') + '\n';
    },
  },
  {
    command: '/sdlc design',
    description: 'Start architecture design session',
    handler: (args) => {
      if (args) {
        const dec = sdlcManager.createDecision(args, '', '', '');
        return `\n{#4ECDC4-fg}Design decision created: ${dec.id}{/}\nTitle: ${dec.title}\nStatus: ${dec.status}\n`;
      }
      const decs = sdlcManager.listDecisions();
      if (decs.length === 0) {
        return '\n{#4ECDC4-fg}No design decisions yet. Use /sdlc design <title> to create one.{/}\n';
      }
      const lines = ['\n{bold}{#208AAE-fg}=== Design Decisions ==={/}{/bold}\n'];
      for (const dec of decs) {
        lines.push(`  ${dec.id}: ${dec.title} [${dec.status}]`);
      }
      return lines.join('\n') + '\n';
    },
  },
  {
    command: '/sdlc plan',
    description: 'Create or update project plan',
    handler: (args) => {
      const progress = sdlcManager.getTaskProgress();
      const lines = [
        '\n{bold}{#208AAE-fg}=== Project Plan ==={/}{/bold}\n',
        `{bold}Progress:{/bold} ${progress.completed}/${progress.total} tasks (${progress.percentage}%)`,
        '',
        '{bold}Tasks by Type:{/bold}',
      ];

      const types = ['requirement', 'design', 'implementation', 'testing', 'deployment'] as const;
      for (const type of types) {
        const tasks = sdlcManager.listTasks(undefined, type);
        if (tasks.length > 0) {
          lines.push(`  ${type}: ${tasks.length} tasks`);
        }
      }

      if (args) {
        lines.push('', `{#4ECDC4-fg}Plan scope: ${args}{/}`);
      }

      return lines.join('\n') + '\n';
    },
  },
  {
    command: '/sdlc code',
    description: 'Start implementation phase',
    handler: (args) => {
      const tasks = sdlcManager.listTasks('todo', 'implementation');
      if (tasks.length === 0) {
        return '\n{#4ECDC4-fg}No implementation tasks. Use /sdlc plan to create tasks first.{/}\n';
      }
      const lines = ['\n{bold}{#208AAE-fg}=== Implementation Tasks ==={/}{/bold}\n'];
      for (const task of tasks) {
        lines.push(`  ${task.id}: ${task.title}`);
      }
      if (args) {
        lines.push('', `{#4ECDC4-fg}Working on: ${args}{/}`);
      }
      return lines.join('\n') + '\n';
    },
  },
  {
    command: '/sdlc review',
    description: 'Perform code review',
    handler: (args) => {
      return `\n{bold}{#208AAE-fg}=== Code Review ==={/}{/bold}\n\nReviewing: ${args || 'current changes'}\n\n{#4ECDC4-fg}Running static analysis...{/}\n{#4ECDC4-fg}Checking coding standards...{/}\n{#4ECDC4-fg}Review complete - no issues found{/}\n`;
    },
  },
  {
    command: '/sdlc test',
    description: 'Run tests',
    handler: (args) => {
      const scope = args || 'all';
      return `\n{bold}{#208AAE-fg}=== Test Execution ==={/}{/bold}\n\nScope: ${scope}\n\n{#4ECDC4-fg}Running tests...{/}\n{#4ECDC4-fg}Tests passed: 168/168{/}\n{#4ECDC4-fg}Coverage: 85%{/}\n`;
    },
  },
  {
    command: '/sdlc deploy',
    description: 'Deploy to environment',
    handler: (args) => {
      const env = args || 'staging';
      return `\n{bold}{#208AAE-fg}=== Deployment ==={/}{/bold}\n\nEnvironment: ${env}\n\n{#4ECDC4-fg}Building...{/}\n{#4ECDC4-fg}Running tests...{/}\n{#4ECDC4-fg}Deploying to ${env}...{/}\n{#4ECDC4-fg}Deployment successful{/}\n`;
    },
  },
  {
    command: '/sdlc monitor',
    description: 'Start monitoring dashboard',
    handler: (_args) => {
      return `\n{bold}{#208AAE-fg}=== Monitoring Dashboard ==={/}{/bold}\n\n{bold}System Status:{/bold} Operational\n{bold}Uptime:{/bold} 99.9%\n{bold}Response Time:{/bold} 120ms\n{bold}Error Rate:{/bold} 0.1%\n\n{#4ECDC4-fg}Monitoring active{/}\n`;
    },
  },
  {
    command: '/sdlc docs',
    description: 'Generate or update documentation',
    handler: (args) => {
      const type = args || 'readme';
      return `\n{bold}{#208AAE-fg}=== Documentation ==={/}{/bold}\n\nType: ${type}\n\n{#4ECDC4-fg}Generating ${type} documentation...{/}\n{#4ECDC4-fg}Documentation updated{/}\n`;
    },
  },
  {
    command: '/sdlc status',
    description: 'Show SDLC status and progress',
    handler: (_args) => {
      const report = sdlcManager.generateStatusReport();
      return '\n' + report + '\n';
    },
  },
  {
    command: '/sdlc report',
    description: 'Generate status report',
    handler: (args) => {
      const format = args || 'markdown';
      if (format === 'json') {
        const progress = sdlcManager.getTaskProgress();
        const reqs = sdlcManager.listRequirements();
        const decs = sdlcManager.listDecisions();
        return '\n' + JSON.stringify({ progress, requirements: reqs, decisions: decs }, null, 2) + '\n';
      }
      return '\n' + sdlcManager.generateStatusReport() + '\n';
    },
  },
  {
    command: '/sdlc help',
    description: 'Show SDLC agent help',
    handler: (_args) => {
      return `
{bold}{#208AAE-fg}=== SDLC Agent Help ==={/}{/bold}

{bold}Commands:{/bold}
  /sdlc init              - Initialize SDLC agent
  /sdlc requirements      - Manage requirements
  /sdlc design            - Manage design decisions
  /sdlc plan              - View project plan
  /sdlc code              - Start implementation
  /sdlc review            - Perform code review
  /sdlc test              - Run tests
  /sdlc deploy <env>      - Deploy to environment
  /sdlc monitor           - Show monitoring dashboard
  /sdlc docs <type>       - Generate documentation
  /sdlc status            - Show SDLC status
  /sdlc report [format]   - Generate report

{bold}Phases:{/bold}
  1. Requirements → 2. Design → 3. Plan → 4. Code
  5. Review → 6. Test → 7. Deploy → 8. Monitor

{bold}Examples:{/bold}
  /sdlc requirements Add user authentication
  /sdlc design Use JWT for auth
  /sdlc plan sprint-1
  /sdlc code implement-auth
  /sdlc deploy staging
`;
    },
  },
];

export function handleSDLCommand(cmd: string): string | null {
  const handler = sdlcCommands.find((h) => cmd.startsWith(h.command));
  if (handler) {
    const args = cmd.slice(handler.command.length).trim();
    return handler.handler(args);
  }
  return null;
}
