import { describe, test, expect } from 'bun:test';
import { estimateTokens, truncateToTokens } from '../src/utils/tokenizer.ts';

describe('Tokenizer', () => {
  test('estimateTokens approximates correctly', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('test')).toBe(1);
    expect(estimateTokens('hello world')).toBe(3);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });

  test('truncateToTokens truncates long text', () => {
    const longText = 'a'.repeat(100);
    const result = truncateToTokens(longText, 10);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(40);
  });

  test('truncateToTokens does not truncate short text', () => {
    const result = truncateToTokens('short', 100);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe('short');
  });
});
