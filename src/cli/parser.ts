export interface CliArgs {
  flags: Record<string, string | boolean>;
  positional: string[];
  subcommand: string | null;
}

export interface CliFlag {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'boolean' | 'number';
  required?: boolean;
  default?: string | boolean | number;
  choices?: string[];
}

export interface CliCommand {
  name: string;
  description: string;
  flags: CliFlag[];
  subcommands?: CliCommand[];
  handler?: (args: CliArgs) => void | Promise<void>;
}

const ROOT_FLAGS: CliFlag[] = [
  { name: 'help', short: 'h', description: 'Show help', type: 'boolean' },
  { name: 'version', description: 'Show version', type: 'boolean' },
  { name: 'print', short: 'p', description: 'Headless query', type: 'string' },
  { name: 'interactive', short: 'i', description: 'Interactive mode', type: 'boolean' },
  { name: 'continue', short: 'c', description: 'Continue last session', type: 'boolean' },
  { name: 'resume', description: 'Resume session by ID', type: 'string' },
  { name: 'model', description: 'LLM model name', type: 'string' },
  { name: 'provider', description: 'LLM provider', type: 'string', choices: ['llamacpp', 'openai', 'anthropic', 'ollama'] },
  { name: 'mode', description: 'Agent mode', type: 'string', choices: ['NORMAL', 'PLAN', 'AUTO', 'YOLO', 'HEADLESS'] },
  { name: 'compose', description: 'Use compose pipeline', type: 'boolean' },
  { name: 'max-tokens', description: 'Max tokens per response', type: 'number' },
  { name: 'temperature', description: 'Sampling temperature', type: 'number' },
  { name: 'timeout', description: 'Request timeout (ms)', type: 'number' },
  { name: 'yolo', description: 'Skip all confirmations', type: 'boolean' },
  { name: 'output-format', description: 'Output format', type: 'string', choices: ['text', 'json', 'markdown'] },
  { name: 'web', description: 'Start web interface', type: 'boolean' },
  { name: 'port', description: 'Port number', type: 'number' },
  { name: 'host', description: 'Bind host', type: 'string' },
  { name: 'no-tui', description: 'Skip TUI, use plain readline', type: 'boolean' },
];

const ROOT_COMMANDS: CliCommand[] = [
  {
    name: 'setup',
    description: 'First-run interactive wizard',
    flags: [],
  },
  {
    name: 'web',
    description: 'Start web interface',
    flags: [
      { name: 'port', description: 'Port number', type: 'number', default: 3333 },
      { name: 'host', description: 'Bind host', type: 'string', default: '0.0.0.0' },
    ],
  },
  {
    name: 'daemon',
    description: 'Start background daemon',
    flags: [
      { name: 'port', description: 'Daemon port', type: 'number', default: 7777 },
      { name: 'workers', description: 'Worker count', type: 'number', default: 4 },
    ],
  },
  {
    name: 'auth',
    description: 'Manage API keys',
    subcommands: [
      { name: 'login', description: 'Add API key', flags: [] },
      { name: 'list', description: 'List stored keys', flags: [] },
      { name: 'logout', description: 'Remove API key', flags: [] },
    ],
    flags: [],
  },
  {
    name: 'session',
    description: 'Manage sessions',
    subcommands: [
      { name: 'list', description: 'List sessions', flags: [] },
      { name: 'resume', description: 'Resume a session', flags: [{ name: 'id', description: 'Session ID', type: 'string', required: true }] },
      { name: 'delete', description: 'Delete a session', flags: [{ name: 'id', description: 'Session ID', type: 'string', required: true }] },
      { name: 'export', description: 'Export session', flags: [{ name: 'id', description: 'Session ID', type: 'string' }, { name: 'format', description: 'Export format', type: 'string', choices: ['json', 'markdown'] }] },
    ],
    flags: [],
  },
  {
    name: 'mcp',
    description: 'Manage MCP servers',
    subcommands: [
      { name: 'add', description: 'Add MCP server', flags: [{ name: 'url', description: 'Server URL', type: 'string', required: true }, { name: 'name', description: 'Server name', type: 'string' }] },
      { name: 'list', description: 'List MCP servers', flags: [] },
      { name: 'remove', description: 'Remove MCP server', flags: [{ name: 'name', description: 'Server name', type: 'string', required: true }] },
    ],
    flags: [],
  },
  {
    name: 'config',
    description: 'Manage configuration',
    subcommands: [
      { name: 'show', description: 'Show current config', flags: [] },
      { name: 'set', description: 'Set config value', flags: [{ name: 'key', description: 'Config key', type: 'string', required: true }, { name: 'value', description: 'Config value', type: 'string', required: true }] },
      { name: 'reset', description: 'Reset to defaults', flags: [] },
    ],
    flags: [],
  },
  {
    name: 'doctor',
    description: 'Check system health',
    flags: [],
  },
];

class Parser {
  private tokens: string[];
  private pos = 0;

  constructor(argv: string[]) {
    this.tokens = argv.slice(2);
  }

  peek(): string | undefined {
    return this.tokens[this.pos];
  }

  advance(): string {
    const token = this.tokens[this.pos];
    this.pos++;
    return token ?? '';
  }

  isFlag(token: string): boolean {
    return token.startsWith('-');
  }

  isEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  parse(): CliArgs {
    const flags: Record<string, string | boolean> = {};
    const positional: string[] = [];
    let subcommand: string | null = null;

    while (!this.isEnd()) {
      const token = this.peek()!;

      if (token === '--') {
        this.advance();
        while (!this.isEnd()) {
          positional.push(this.advance());
        }
        break;
      }

      if (this.isFlag(token)) {
        this.parseFlag(flags);
      } else if (!subcommand) {
        subcommand = token;
        this.advance();
      } else {
        positional.push(token);
        this.advance();
      }
    }

    return { flags, positional, subcommand };
  }

  private parseFlag(flags: Record<string, string | boolean>): void {
    const token = this.advance();

    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');
      if (eqIdx > 0) {
        const key = token.slice(2, eqIdx);
        const val = token.slice(eqIdx + 1);
        flags[key] = val;
      } else {
        const key = token.slice(2);
        const next = this.peek();
        if (next && !this.isFlag(next)) {
          flags[key] = next;
          this.advance();
        } else {
          flags[key] = true;
        }
      }
    } else if (token.startsWith('-')) {
      const key = token.slice(1);
      const next = this.peek();
      if (next && !this.isFlag(next)) {
        flags[key] = next;
        this.advance();
      } else {
        flags[key] = true;
      }
    }
  }
}

export function parseArgs(argv: string[]): CliArgs {
  const parser = new Parser(argv);
  return parser.parse();
}

export function getFlag(args: CliArgs, name: string): string | undefined {
  const val = args.flags[name];
  return typeof val === 'string' ? val : undefined;
}

export function getNumberFlag(args: CliArgs, name: string): number | undefined {
  const val = args.flags[name];
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num)) return num;
  }
  return undefined;
}

export function hasFlag(args: CliArgs, name: string): boolean {
  return args.flags[name] !== undefined;
}

export function generateHelp(commands: CliCommand[], flags: CliFlag[]): string {
  const lines: string[] = [];
  lines.push('Usage: kairos [command] [options]');
  lines.push('');
  lines.push('Commands:');
  for (const cmd of commands) {
    lines.push(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
  }
  lines.push('');
  lines.push('Options:');
  for (const flag of flags) {
    const short = flag.short ? `-${flag.short}, ` : '    ';
    const type = flag.type === 'boolean' ? '' : ` <${flag.type}>`;
    lines.push(`  ${short}--${flag.name}${type}  ${flag.description}`);
  }
  return lines.join('\n');
}

export function generateCommandHelp(command: CliCommand): string {
  const lines: string[] = [];
  lines.push(`Usage: kairos ${command.name} [subcommand] [options]`);
  lines.push('');
  lines.push(command.description);
  lines.push('');

  if (command.subcommands && command.subcommands.length > 0) {
    lines.push('Subcommands:');
    for (const sub of command.subcommands) {
      lines.push(`  ${sub.name.padEnd(12)} ${sub.description}`);
    }
    lines.push('');
  }

  if (command.flags.length > 0) {
    lines.push('Options:');
    for (const flag of command.flags) {
      const type = flag.type === 'boolean' ? '' : ` <${flag.type}>`;
      lines.push(`  --${flag.name}${type}  ${flag.description}`);
    }
  }

  return lines.join('\n');
}
