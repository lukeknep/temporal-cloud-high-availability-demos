// src/workflows.ts
import { proxyActivities, sleep, defineQuery, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';

const {
  pingOnce,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds', // per activity call
  retry: {
    maximumAttempts: 5,
  },
});

export interface LatencyMonitorParams {
  /** ID/label for this workflow run, for display */
  id: string;
  /** URL to ping */
  url: string;
  /** N pings per set */
  numPings?: number;
  /** Time between sets, in seconds */
  sleepInterval?: number;
}

export interface LatencySetResult {
  setIndex: number;          // which iteration (0,1,2,...)
  startedAt: string;         // ISO timestamp
  endedAt: string;           // ISO timestamp
  avgMs: number;
  minMs: number;
  maxMs: number;
  samplesMs: number[];       // individual pings in this set
}

export interface LatencyStatsQueryResult {
  id: string;
  url: string;
  lastSets: LatencySetResult[];  // up to 5
  overallMinMs: number | null;
  overallMaxMs: number | null;
}

export const getStatsQuery = defineQuery<LatencyStatsQueryResult>('getStats');

/**
 * Infinite monitoring workflow: pings URL N times per set, 0.1s between pings,
 * computes avg/min/max latency, then sleeps T seconds, and repeats.
 */
export async function latencyMonitorWorkflow(
  params: LatencyMonitorParams
): Promise<void> {
  const { id, url } = params;
  const numPings = params.numPings || 5;
  const sleepInterval = params.sleepInterval || 5;

  // validate workflow input
  if (numPings <= 0 || numPings > 99999) {
    throw new Error('n must be > 0 and <= 99999');
  }
  if (sleepInterval <= 0 || sleepInterval > 60 * 60 * 24 * 30) {
    throw new Error('setIntervalSeconds must be > 0 and less than a month');
  }
  if (!id) {
    throw new Error('id must be set');
  }
  if (!url) {
    throw new Error('url must be set');
  }

  // State that Queries will read
  const lastSets: LatencySetResult[] = [];
  let overallMin = Number.POSITIVE_INFINITY;
  let overallMax = Number.NEGATIVE_INFINITY;
  let setCounter = 0;

  // Query handler: read-only, no activities, no side effects
  setHandler(getStatsQuery, (): LatencyStatsQueryResult => ({
    id,
    url,
    lastSets,
    overallMinMs: isFinite(overallMin) ? overallMin : null,
    overallMaxMs: isFinite(overallMax) ? overallMax : null,
  }));

  // Infinite monitoring loop
  // This workflow is designed to run "forever" until cancelled.
  while (true) {
    const latencies: number[] = [];

    const startedAt = new Date().toISOString(); // workflow time-safe in JS SDK

    // N sequential pings with 0.1 seconds between each
    for (let i = 0; i < numPings; i++) {
      const latencyMs = await pingOnce({ url });
      latencies.push(latencyMs);

      // Sleep 0.1 seconds between pings, except after the final one
      if (i < numPings - 1) {
        await sleep(100); // 100 ms
      }
    }

    const endedAt = new Date().toISOString(); // workflow time-safe in JS SDK

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = sum / latencies.length;

     const setResult: LatencySetResult = {
      setIndex: setCounter++,
      startedAt,
      endedAt,
      avgMs: avg,
      minMs: min,
      maxMs: max,
      samplesMs: latencies,
    };

    lastSets.push(setResult);
    if (lastSets.length > 10) lastSets.shift();

    // Update overall min/max
    if (min < overallMin) overallMin = min;
    if (max > overallMax) overallMax = max;

    // Sleep T seconds between sets
    await sleep(sleepInterval * 1000);
  }
}
