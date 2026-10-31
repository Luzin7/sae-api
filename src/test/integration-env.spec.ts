import { describe, expect, it } from 'vitest';
import {
  IntegrationDatabaseRequiredError,
  resolveIntegrationUrl,
} from './integration-env.js';

describe('resolveIntegrationUrl', () => {
  it('lança quando a integração é exigida e a URL falta', () => {
    expect(() => resolveIntegrationUrl({ REQUIRE_INTEGRATION: '1' })).toThrow(
      IntegrationDatabaseRequiredError,
    );
  });

  it('retorna a URL quando exigida e configurada', () => {
    expect(
      resolveIntegrationUrl({
        REQUIRE_INTEGRATION: '1',
        INTEGRATION_DATABASE_URL: 'postgres://x',
      }),
    ).toBe('postgres://x');
  });

  it('retorna undefined quando nada é exigido nem configurado', () => {
    expect(resolveIntegrationUrl({})).toBeUndefined();
  });
});
