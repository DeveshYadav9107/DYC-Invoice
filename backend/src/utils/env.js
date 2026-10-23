import dotenv from 'dotenv';
dotenv.config();

export function validateEnv() {
  const required = ['DATABASE_URL', 'AUTH_SECRET'];
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    console.warn(`⚠️ [Warning] Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    PORT: parseInt(process.env.PORT || '5000', 10),
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.DOCUMENT_INTELLIGENCE_ENDPOINT,
    DOCUMENT_INTELLIGENCE_KEY: process.env.DOCUMENT_INTELLIGENCE_KEY,
    AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER || 'invoices',
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    REDIS_URL: process.env.REDIS_URL,
    UPLOAD_MAX_SIZE_MB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10),
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
  };
}

export function checkSmtpConfig() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

export function checkDocIntelligenceConfig() {
  const required = ['DOCUMENT_INTELLIGENCE_ENDPOINT', 'DOCUMENT_INTELLIGENCE_KEY'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

export function checkStorageConfig() {
  const required = ['AZURE_STORAGE_CONNECTION_STRING'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

export function checkRedisConfig() {
  const required = ['REDIS_URL'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}
