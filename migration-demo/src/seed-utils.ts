import fetch from 'node-fetch';
import { LatencyEntry, WCDHistory } from './types';

export const SEED_URLS = [
  'https://raw.githubusercontent.com/temporalio/temporal/refs/heads/main/README.md',
  'https://www.federalreserve.gov/feeds/press_all.xml',
  'https://ha-demo-us-east-2.s3.amazonaws.com/hello.txt',
  'https://ha-demo-us-east-1.s3.amazonaws.com/hello.txt',
  'https://ha-demo-ap-northeast-1.s3.amazonaws.com/hello.txt',
  'https://temporal.io/',
];
export const SEED_SLEEP_INTERVAL = 10;          // seconds between checks
export const SEED_HISTORY_MINUTES = 10;         // generate this many minutes of history
export const SEED_ENTRIES = (SEED_HISTORY_MINUTES * 60) / SEED_SLEEP_INTERVAL;

export async function measureLatency(url: string): Promise<number> {
  const start = Date.now();
  try {
    await fetch(url, { method: 'GET', timeout: 10000 });
  } catch (err) {
    console.warn(`Latency sample for ${url} failed, using 100ms fallback:`, err);
    return 100;
  }
  return Math.max(1, Date.now() - start);
}

export function buildHistory(baseLatencyMs: number): WCDHistory {
  const now = Date.now();
  const latencies: LatencyEntry[] = [];
  for (let i = SEED_ENTRIES - 1; i >= 0; i--) {
    const ts = new Date(now - i * SEED_SLEEP_INTERVAL * 1000).toISOString();
    const jitter = Math.random() * 0.5 - 0.25; // -25%..+25%
    latencies.push({
      latency: Math.max(1, baseLatencyMs * (1 + jitter)),
      timestamp: ts,
    });
  }
  const contentLastCheckedAt = latencies[latencies.length - 1].timestamp;
  const changeAgoMs = Math.random() * 24 * 60 * 60 * 1000;
  const contentLastChangedAt = new Date(now - changeAgoMs).toISOString();
  return { contentLastCheckedAt, contentLastChangedAt, latencies };
}

export function randomWorkflowId(): string {
  return `workflow-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}
