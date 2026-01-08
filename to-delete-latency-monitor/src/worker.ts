// src/worker.ts
import { Worker, NativeConnectionOptions, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';

import { loadConfig } from './config';

const TASK_QUEUE = 'latency-monitor';

async function run() {
    const { temporal } = loadConfig();

  let connectionOptions: NativeConnectionOptions = {
    address: temporal.address,
  };

  // TODO add mTLS as an optional auth config
  // if (clientCert && clientKey) {
  // // Configure mTLS authentication if certificate and key are provided
  // connectionOptions.tls = {
  //     clientCertPair: {
  //       crt: clientCert,
  //       key: clientKey,
  //     },
  //   };
  // } else if (apiKey) {

    // API key authentication
    connectionOptions.tls = true;
    connectionOptions.apiKey = temporal.apiKey;
    connectionOptions.metadata = {
      'temporal-namespace': temporal.namespace,
    };

  // Create the connection
  const connection = await NativeConnection.connect(connectionOptions);

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
