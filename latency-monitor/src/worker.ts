// src/worker.ts
import { Connection } from '@temporalio/client';
import { Worker } from '@temporalio/worker';
import * as activities from './activities';

import { loadConfig } from './config';

const TASK_QUEUE = 'latency-monitor';

async function run() {
    const { temporal } = loadConfig();

  // Connect to Temporal Cloud
  const connection = await Connection.connect({
    address: temporal.address,
    tls: {},
    apiKey: temporal.apiKey,
  });

  const worker = await Worker.create({
    connection,
    namespace: temporal.namespace,
    taskQueue: TASK_QUEUE,
    // Important: compiled workflows file (after tsc -> lib/)
    workflowsPath: require.resolve('../lib/workflows'),
    activities,
  });

  console.log(
    `Worker started. Namespace="${temporal.namespace}", address="${temporal.address}", taskQueue="${TASK_QUEUE}"`
  );
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed', err);
  process.exit(1);
});
