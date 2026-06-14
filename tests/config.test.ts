import { describe, test, expect } from 'bun:test';
import { KairosConfigSchema, safeValidateConfig } from '../src/config/schema.ts';
import { DEFAULT_CONFIG } from '../src/config/defaults.ts';

describe('Config Schema', () => {
  test('DEFAULT_CONFIG validates against schema', () => {
    const result = safeValidateConfig(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });

  test('minimal config validates', () => {
    const result = safeValidateConfig({});
    expect(result.success).toBe(true);
  });

  test('invalid provider rejected', () => {
    const result = safeValidateConfig({ llm: { provider: 'invalid' } });
    expect(result.success).toBe(false);
  });

  test('temperature range enforced', () => {
    const result = safeValidateConfig({ llm: { temperature: 5 } });
    expect(result.success).toBe(false);
  });

  test('valid temperature accepted', () => {
    const result = safeValidateConfig({ llm: { temperature: 1.5 } });
    expect(result.success).toBe(true);
  });

  test('safety config defaults', () => {
    const result = safeValidateConfig({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.safety.enabled).toBe(true);
      expect(result.data.safety.autoApprove).toBe(false);
    }
  });
});
