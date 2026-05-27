/**
 * Seed a batch of already-closed workflows so the namespace looks like it has
 * been running for a while.
 *
 * Each workflow is started with the same fabricated history used by the
 * web app's "Seed starting state" button, plus `closeImmediately: true`
 * so the worker exits the workflow right after setting up handlers.
 *
 * Requires a running worker (`npm run worker`) so the workflow tasks are
 * actually picked up and the workflows transition to Completed.
 *
 * Usage:
 *   npm run seed-closed          # seeds 6 (one per URL)
 *   npm run seed-closed -- 20    # seeds 20 (cycles through URLs)
 */
import { Connection, Client } from '@temporalio/client';
import fs from 'fs';
import path from 'path';
import { webpageChangeDetectorWorkflow } from '../temporal/workflows';
import { WCDWorkflowParams } from '../types';
import {
  SEED_URLS,
  SEED_SLEEP_INTERVAL,
  measureLatency,
  buildHistory,
  randomWorkflowId,
} from '../seed-utils';

interface TemporalTarget {
  address: string;
  namespace: string;
  apiKey?: string;
}

async function connectClient(target: TemporalTarget): Promise<Client> {
  const connection = await Connection.connect({
    address: target.address,
    tls: target.apiKey ? true : undefined,
    apiKey: target.apiKey || undefined,
    metadata: target.apiKey ? {
      'temporal-namespace': target.namespace,
    } : undefined,
  });
  console.log(`connected to ${target.address} / ${target.namespace}`);
  return new Client({ connection, namespace: target.namespace });
}

async function run() {
  const countArg = parseInt(process.argv[2] || `${SEED_URLS.length}`, 10);
  const count = Number.isFinite(countArg) && countArg > 0 ? countArg : SEED_URLS.length;

  const configPath = path.join(__dirname, '..', '..', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const t = config.temporal;

  if (!t.address || !t.namespace) {
    throw new Error('temporal.address / temporal.namespace not configured in config.json');
  }

  const client = await connectClient({
    address: t.address,
    namespace: t.namespace,
    apiKey: t.apiKey,
  });

  const started: string[] = [];
  for (let i = 0; i < count; i++) {
    const url = SEED_URLS[i % SEED_URLS.length];
    const id = randomWorkflowId();
    const baseLatency = await measureLatency(url);
    const history = buildHistory(baseLatency);

    const params: WCDWorkflowParams = {
      id,
      url,
      sleepInterval: SEED_SLEEP_INTERVAL,
      history,
      closeImmediately: true,
    };
    try {
      await client.workflow.start(webpageChangeDetectorWorkflow, {
        taskQueue: 'webpage-change-detector',
        workflowId: id,
        args: [params],
        workflowTaskTimeout: '120s',
      });
      started.push(id);
      console.log(`[${i + 1}/${count}] started ${id} (url=${url})`);
    } catch (err: any) {
      console.error(`[${i + 1}/${count}] failed for ${id} (${url}):`, err.message);
    }
  }

  console.log(`\nSeeded ${started.length}/${count} closed workflows.`);
  console.log('A worker must be running for the workflows to close: npm run worker');
  process.exit(0);
}

run().catch((err) => {
  console.error('seed-closed error:', err);
  process.exit(1);
});
