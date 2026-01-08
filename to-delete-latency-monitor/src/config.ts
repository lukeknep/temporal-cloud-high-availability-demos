// src/config.ts
import fs from 'fs';
import path from 'path';

export interface TemporalConfig {
  address: string;
  namespace: string;
  apiKey?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface AppConfig {
  temporal: TemporalConfig;
  smtp: SmtpConfig;
}

let cachedConfig: AppConfig | null = null;

/**
 * Load config from JSON.
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = path.join(__dirname, '..', 'config.json');

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);

  // Minimal sanity checks (you can expand this as needed)
  if (!parsed.temporal?.address || !parsed.temporal?.namespace) {
    throw new Error('Invalid config: temporal.address and temporal.namespace are required');
  }
  if (!parsed.smtp?.host || !parsed.smtp?.user || !parsed.smtp?.pass) {
    throw new Error('Invalid config: smtp.host/user/pass are required');
  }

  cachedConfig = parsed as AppConfig;
  return cachedConfig!;
}
