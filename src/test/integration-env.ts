export class IntegrationDatabaseRequiredError extends Error {
  constructor() {
    super(
      'REQUIRE_INTEGRATION está ativo, mas INTEGRATION_DATABASE_URL não foi definida: os testes de integração não podem ser pulados.',
    );
    this.name = 'IntegrationDatabaseRequiredError';
  }
}

export function resolveIntegrationUrl(
  env: NodeJS.ProcessEnv,
): string | undefined {
  const url = env.INTEGRATION_DATABASE_URL;
  if (url) return url;
  if (env.REQUIRE_INTEGRATION) throw new IntegrationDatabaseRequiredError();
  return undefined;
}

const integrationUrl = resolveIntegrationUrl(process.env);
if (integrationUrl) process.env.DATABASE_URL = integrationUrl;

export const integrationEnabled = Boolean(integrationUrl);
