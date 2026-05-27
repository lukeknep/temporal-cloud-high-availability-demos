import { proxyActivities, condition, defineQuery, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';
import { WCDWorkflowParams, WCDQueryResult, LatencyEntry } from '../types';

const { fetchWebpageContent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1s',
    maximumInterval: '1s',
    backoffCoefficient: 1,
    maximumAttempts: 100,
  },
});

const MAX_CHECKS = 1000;

export const getStatusQuery = defineQuery<WCDQueryResult>('getStatus');
export const closeSignal = defineSignal('close');

export async function webpageChangeDetectorWorkflow(
  params: WCDWorkflowParams
): Promise<void> {
  const { id, url, sleepInterval, history, closeImmediately } = params;

  let contentLastCheckedAt: string | null = history?.contentLastCheckedAt ?? null;
  let contentLastChangedAt: string | null = history?.contentLastChangedAt ?? null;
  let latencies: LatencyEntry[] = history?.latencies ? [...history.latencies] : [];
  let lastContentHash: string | null = null;
  // When started from history, treat the first fetch as the baseline so it
  // doesn't falsely register as a "change" for the hand-off.
  let treatNextFetchAsBaseline = !!history;
  let shouldClose = false;
  let checkCount = 0;

  setHandler(getStatusQuery, (): WCDQueryResult => {
    return {
      id,
      url,
      sleepInterval,
      contentLastCheckedAt,
      contentLastChangedAt,
      latencies,
    };
  });

  setHandler(closeSignal, () => {
    shouldClose = true;
  });

  if (closeImmediately) {
    return;
  }

  while (!shouldClose && checkCount < MAX_CHECKS) {
    try {
      const result = await fetchWebpageContent(url);

      if (treatNextFetchAsBaseline) {
        lastContentHash = result.contentHash;
        treatNextFetchAsBaseline = false;
      } else if (result.contentHash !== lastContentHash) {
        lastContentHash = result.contentHash;
        contentLastChangedAt = result.timestamp;
      }

      contentLastCheckedAt = result.timestamp;
      latencies.push({
        latency: result.latencyMs,
        timestamp: result.timestamp
      });
      if (latencies.length > 100) {
        latencies = latencies.slice(-100);
      }
      checkCount++;

    } catch (error) {
      console.error(`Error checking ${url}:`, error);
    }

    if (shouldClose || checkCount >= MAX_CHECKS) break;

    // Sleep until the interval elapses OR the close signal arrives.
    await condition(() => shouldClose, `${sleepInterval}s`);
  }
}
