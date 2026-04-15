import fetch from 'node-fetch';
import { createHash } from 'crypto';

export interface FetchWebpageResult {
  contentHash: string;
  latencyMs: number;
  timestamp: string;
}

export async function fetchWebpageContent(url: string): Promise<FetchWebpageResult> {
  try {
    // Capture the timestamp when the check begins
    const checkTimestamp = new Date().toISOString();

    // First request: Measure ping latency with a HEAD request
    const pingStartTime = Date.now();

    // Second request: Fetch actual content for change detection
    const contentResponse = await fetch(url, {
      method: 'GET',
      timeout: 30000, // 30 second timeout
    });

    const latencyMs = Date.now() - pingStartTime;

    if (!contentResponse.ok) {
      throw new Error(`HTTP error! status: ${contentResponse.status}`);
    }

    const content = await contentResponse.text();

    // Hash the content in the activity (workflows can't use crypto)
    const contentHash = createHash('sha256')
      .update(content)
      .digest('hex');

    return {
      contentHash,
      latencyMs,
      timestamp: checkTimestamp,
    };
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
