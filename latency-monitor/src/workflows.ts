// src/workflows.ts
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities';

const {
  pingOnce,
  sendEmail,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds', // per activity call
  retry: {
    maximumAttempts: 5,
  },
});

export interface LatencyMonitorParams {
  /** ID/label for this workflow run, included in the email subject */
  monitorId: string;
  /** URL to ping */
  url: string;
  /** N pings per set */
  n: number;
  /** Time between sets, in seconds */
  setIntervalSeconds: number;
  /** Email to send results to */
  email: string;
}

/**
 * Infinite monitoring workflow: pings URL N times per set, 0.1s between pings,
 * computes avg/min/max latency, emails result, then sleeps T seconds, and repeats.
 */
export async function latencyMonitorWorkflow(
  params: LatencyMonitorParams
): Promise<void> {
  const { monitorId, url, n, setIntervalSeconds, email } = params;

  // Basic validation (deterministic)
  if (n <= 0) {
    throw new Error('n must be > 0');
  }
  if (setIntervalSeconds <= 0) {
    throw new Error('setIntervalSeconds must be > 0');
  }

  // Infinite monitoring loop
  // This workflow is designed to run "forever" until cancelled.
  while (true) {
    const latencies: number[] = [];

    // N sequential pings with 0.1 seconds between each
    for (let i = 0; i < n; i++) {
      const latencyMs = await pingOnce({ url });
      latencies.push(latencyMs);

      // Sleep 0.1 seconds between pings, except after the final one
      if (i < n - 1) {
        await sleep(100); // 100 ms
      }
    }

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = sum / latencies.length;

    const subject = `[${monitorId}] ${url} :: avg=${avg.toFixed(
      1
    )}ms min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms`;

    const bodyLines: string[] = [
      `Monitor ID: ${monitorId}`,
      `URL: ${url}`,
      '',
      `Pings this set: ${n}`,
      `Average latency: ${avg.toFixed(2)} ms`,
      `Min latency: ${min.toFixed(2)} ms`,
      `Max latency: ${max.toFixed(2)} ms`,
      '',
      'Individual pings (ms):',
      ...latencies.map((v, idx) => `  #${idx + 1}: ${v.toFixed(2)} ms`),
      '',
      `Next set will start in ${setIntervalSeconds} seconds (workflow timer).`,
    ];

    await sendEmail({
      to: email,
      subject,
      body: bodyLines.join('\n'),
    });

    // Sleep T seconds between sets
    await sleep(setIntervalSeconds * 1000);
  }
}
