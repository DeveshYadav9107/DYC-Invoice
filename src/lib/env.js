// ─────────────────────────────────────────────────────────────────
// Environment variable validation
// Validates all required env vars at server startup
// ─────────────────────────────────────────────────────────────────

/**
 * Checks whether a variable is set and non-empty.
 * Returns the value or undefined.
 */
function getEnv(name, required = false) {
  const value = process.env[name];
  if (required && (!value || value.trim() === '')) {
    throw new Error(
      `❌ Missing required environment variable: ${name}\n` +
      `   Please set it in your .env.local file.\n` +
      `   See .env.example for reference.`
    );
  }
  return value || undefined;
}

/**
 * Validates and returns all environment configuration.
 * Call this once at server startup to fail fast on missing config.
 */
export function validateEnv() {
  const errors = [];

  const check = (name) => {
    const value = process.env[name];
    if (!value || value.trim() === '') {
      errors.push(name);
    }
    return value || undefined;
  };

  const env = {
    // Database
    DATABASE_URL: check('DATABASE_URL'),
    DIRECT_URL: check('DIRECT_URL'),

    // Azure Document Intelligence (optional — extraction won't work without it)
    DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.DOCUMENT_INTELLIGENCE_ENDPOINT || undefined,
    DOCUMENT_INTELLIGENCE_KEY: process.env.DOCUMENT_INTELLIGENCE_KEY || undefined,

    // Azure Blob Storage (optional — uploads won't work without it)
    AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING || undefined,
    AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER || 'invoices',

    // SMTP (required for authentication)
    SMTP_HOST: process.env.SMTP_HOST || undefined,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: process.env.SMTP_USER || undefined,
    SMTP_PASS: process.env.SMTP_PASS || undefined,
    SMTP_FROM: process.env.SMTP_FROM || undefined,

    // Redis
    REDIS_URL: process.env.REDIS_URL || undefined,

    // Auth
    AUTH_SECRET: check('AUTH_SECRET'),

    // Application
    APP_URL: process.env.APP_URL || 'http://localhost:3000',
    UPLOAD_MAX_SIZE_MB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10),

    // Seed accounts (only needed for seeding)
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || undefined,
    SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || undefined,
    SEED_CLIENT_EMAIL: process.env.SEED_CLIENT_EMAIL || undefined,
    SEED_CLIENT_NAME: process.env.SEED_CLIENT_NAME || undefined,
    SEED_ORGANIZATION_NAME: process.env.SEED_ORGANIZATION_NAME || undefined,
  };

  return { env, errors };
}

/**
 * Checks if SMTP is configured. 
 * Returns { configured: boolean, missing: string[] }
 */
export function checkSmtpConfig() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

/**
 * Checks if Azure Document Intelligence is configured.
 */
export function checkDocIntelligenceConfig() {
  const required = ['DOCUMENT_INTELLIGENCE_ENDPOINT', 'DOCUMENT_INTELLIGENCE_KEY'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

/**
 * Checks if Azure Blob Storage is configured.
 */
export function checkStorageConfig() {
  const required = ['AZURE_STORAGE_CONNECTION_STRING'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

/**
 * Checks if Redis is configured.
 */
export function checkRedisConfig() {
  const required = ['REDIS_URL'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}
