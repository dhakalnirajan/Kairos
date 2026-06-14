import { describe, test, expect } from 'bun:test';
import { parseArgs, getFlag, hasFlag } from '../src/cli/parser.ts';

describe('CLI Parser', () => {
  test('parses subcommand', () => {
    const args = parseArgs(['node', 'kairos', 'setup']);
    expect(args.subcommand).toBe('setup');
    expect(args.positional).toEqual([]);
  });

  test('parses flags', () => {
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

  test('parses positional args', () => {
    const args = parseArgs(['node', 'kairos', 'session', 'list']);
    expect(args.subcommand).toBe('session');
    expect(args.positional).toEqual(['list']);
  });

  test('empty args', () => {
    const args = parseArgs(['node', 'kairos']);
    expect(args.subcommand).toBeNull();
    expect(args.positional).toEqual([]);
  });

  test('hasFlag for missing flag', () => {
    const args = parseArgs(['node', 'kairos']);
    expect(hasFlag(args, 'anything')).toBe(false);
  });
});
