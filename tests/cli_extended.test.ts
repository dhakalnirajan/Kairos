import { describe, test, expect } from 'bun:test';
import { parseArgs, getFlag, getNumberFlag, hasFlag, generateHelp, generateCommandHelp, type CliCommand } from '../src/cli/parser.ts';

describe('Recursive Descent Parser', () => {
  test('parses simple subcommand', () => {
    const args = parseArgs(['node', 'kairos', 'setup']);
    expect(args.subcommand).toBe('setup');
    expect(args.positional).toEqual([]);
  });

  test('parses flags with values', () => {
    const args = parseArgs(['node', 'kairos', '-p', 'hello', '--mode', 'NORMAL']);
    expect(getFlag(args, 'p')).toBe('hello');
    expect(getFlag(args, 'mode')).toBe('NORMAL');
  });

  test('parses boolean flags', () => {
    const args = parseArgs(['node', 'kairos', '--help']);
    expect(hasFlag(args, 'help')).toBe(true);
    expect(hasFlag(args, 'version')).toBe(false);
  });

  test('parses = syntax', () => {
    const args = parseArgs(['node', 'kairos', '--model=gpt-4']);
    expect(getFlag(args, 'model')).toBe('gpt-4');
  });

  test('parses positional args after subcommand', () => {
    const args = parseArgs(['node', 'kairos', 'session', 'list']);
    expect(args.subcommand).toBe('session');
    expect(args.positional).toEqual(['list']);
  });

  test('parses -- separator', () => {
    const args = parseArgs(['node', 'kairos', '--', 'extra', 'args']);
    expect(args.positional).toEqual(['extra', 'args']);
  });

  test('parses number flags', () => {
    const args = parseArgs(['node', 'kairos', '--port', '8080']);
    expect(getNumberFlag(args, 'port')).toBe(8080);
  });

  test('empty args', () => {
    const args = parseArgs(['node', 'kairos']);
    expect(args.subcommand).toBeNull();
    expect(args.positional).toEqual([]);
  });

  test('multiple flags', () => {
    const args = parseArgs(['node', 'kairos', '-p', 'query', '--provider', 'ollama', '--model', 'llama3', '--temperature', '0.5']);
    expect(getFlag(args, 'p')).toBe('query');
    expect(getFlag(args, 'provider')).toBe('ollama');
    expect(getFlag(args, 'model')).toBe('llama3');
    expect(getNumberFlag(args, 'temperature')).toBe(0.5);
  });

  test('subcommand with flags', () => {
    const args = parseArgs(['node', 'kairos', 'web', '--port', '3333', '--host', '127.0.0.1']);
    expect(args.subcommand).toBe('web');
    expect(getNumberFlag(args, 'port')).toBe(3333);
    expect(getFlag(args, 'host')).toBe('127.0.0.1');
  });

  test('daemon subcommand with workers', () => {
    const args = parseArgs(['node', 'kairos', 'daemon', '--port', '7777', '--workers', '8']);
    expect(args.subcommand).toBe('daemon');
    expect(getNumberFlag(args, 'port')).toBe(7777);
    expect(getNumberFlag(args, 'workers')).toBe(8);
  });
});

describe('Help Generation', () => {
  test('generateHelp produces usage string', () => {
    const commands: CliCommand[] = [
      { name: 'setup', description: 'Run setup wizard', flags: [] },
      { name: 'web', description: 'Start web server', flags: [] },
    ];
    const flags = [
      { name: 'help', short: 'h', description: 'Show help', type: 'boolean' as const },
      { name: 'model', description: 'LLM model', type: 'string' as const },
    ];
    const help = generateHelp(commands, flags);
    expect(help).toContain('Usage: kairos');
    expect(help).toContain('setup');
    expect(help).toContain('web');
    expect(help).toContain('--help');
    expect(help).toContain('--model');
  });

  test('generateCommandHelp produces subcommand help', () => {
    const cmd: CliCommand = {
      name: 'auth',
      description: 'Manage API keys',
      flags: [],
      subcommands: [
        { name: 'login', description: 'Add API key', flags: [] },
        { name: 'list', description: 'List keys', flags: [] },
      ],
    };
    const help = generateCommandHelp(cmd);
    expect(help).toContain('auth');
    expect(help).toContain('login');
    expect(help).toContain('list');
  });
});

describe('Flag Utilities', () => {
  test('getFlag returns undefined for missing flag', () => {
    const args = parseArgs(['node', 'kairos']);
    expect(getFlag(args, 'missing')).toBeUndefined();
  });

  test('getNumberFlag returns undefined for string flags', () => {
    const args = parseArgs(['node', 'kairos', '--name', 'test']);
    expect(getNumberFlag(args, 'name')).toBeUndefined();
  });

  test('getNumberFlag returns number for numeric strings', () => {
    const args = parseArgs(['node', 'kairos', '--port', '3000']);
    expect(getNumberFlag(args, 'port')).toBe(3000);
  });

  test('hasFlag returns true for present flags', () => {
    const args = parseArgs(['node', 'kairos', '--yolo']);
    expect(hasFlag(args, 'yolo')).toBe(true);
    expect(hasFlag(args, 'safe')).toBe(false);
  });
});
