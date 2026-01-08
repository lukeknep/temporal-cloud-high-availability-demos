import { proxyActivities, sleep, defineQuery, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';
import { WCDWorkflowParams, WCDQueryResult, LatencyEntry } from '../types';

const { fetchWebpageContent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '5s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
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

  // Set up query handler
  setHandler(getStatusQuery, (): WCDQueryResult => {
    return {
      id,
      url,
      contentLastCheckedAt,
      contentLastChangedAt,
      latencies,
    };
  });

  // Main monitoring loop
  while (true) {
    try {
      // Fetch webpage content
      const result = await fetchWebpageContent(url);

      // Update last checked timestamp
      const checkTimestamp = new Date().toISOString();
      contentLastCheckedAt = checkTimestamp;

      // Store latency with timestamp (keep max 100 entries)
      latencies.push({
        latency: result.latencyMs,
        timestamp: checkTimestamp
      });
      if (latencies.length > 100) {
        latencies = latencies.slice(-100);
      }

      // Get the content hash from the activity result
      const currentContentHash = result.contentHash;

      // Check if content has changed
      if (lastContentHash === null) {
        // First check - initialize
        lastContentHash = currentContentHash;
        contentLastChangedAt = new Date().toISOString();
      } else if (currentContentHash !== lastContentHash) {
        // Content has changed
        lastContentHash = currentContentHash;
        contentLastChangedAt = new Date().toISOString();
      }
      // If hashes match, content hasn't changed - don't update contentLastChangedAt

    } catch (error) {
      // Log error but continue monitoring
      console.error(`Error checking ${url}:`, error);
    }

    // Sleep for the specified interval (convert seconds to milliseconds)
    await sleep(sleepInterval * 1000);
  }
}
