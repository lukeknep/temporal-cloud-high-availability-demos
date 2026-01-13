import { proxyActivities, sleep, defineQuery, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';
import { WCDWorkflowParams, WCDQueryResult, LatencyEntry } from '../types';

const { fetchWebpageContent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '10s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 2,
  },
});

export const getStatusQuery = defineQuery<WCDQueryResult>('getStatus');

export async function webpageChangeDetectorWorkflow(
  params: WCDWorkflowParams
): Promise<void> {
  const { id, url, sleepInterval } = params;

  let contentLastCheckedAt: string | null = null;
  let contentLastChangedAt: string | null = null;
  let latencies: LatencyEntry[] = [];
  let lastContentHash: string | null = null;

  // Set up the Query, for visibility
  setHandler(getStatusQuery, (): WCDQueryResult => {
    return {
      id,
      url,
      contentLastCheckedAt,
      contentLastChangedAt,
      latencies,
    };
  });

  // Monitoring loop
  while (true) {
    try {
      // Fetch webpage content
      const result = await fetchWebpageContent(url);
      
      // Check if content has changed
      if (result.contentHash !== lastContentHash) {
        lastContentHash = result.contentHash;
        contentLastChangedAt = result.timestamp;
        // In the future, you could add a notification / email alert here, write to a database, etc.
      }
      
      // Record the latency and timestamp
      contentLastCheckedAt = result.timestamp;
      latencies.push({
        latency: result.latencyMs,
        timestamp: result.timestamp
      });
      if (latencies.length > 100) {
        latencies = latencies.slice(-100);
      }

    } catch (error) {
      console.error(`Error checking ${url}:`, error);
    }

    await sleep(sleepInterval * 1000);
  }
}
