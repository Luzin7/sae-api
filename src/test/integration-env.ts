const integrationUrl = process.env.INTEGRATION_DATABASE_URL;
if (integrationUrl) process.env.DATABASE_URL = integrationUrl;

export const integrationEnabled = Boolean(integrationUrl);
