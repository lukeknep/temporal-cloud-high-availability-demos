import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import fs from 'fs';
import path from 'path';

async function run() {
  // Read config file
  const configPath = path.join(__dirname, '..', '..', 'config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);

  const { address, namespace, apiKey } = config.temporal;

  // Create connection to Temporal Cloud
  const connection = await NativeConnection.connect({
    address,
    tls: {
      // Temporal Cloud requires TLS
      clientCertPair: undefined,
    },
    metadata: {
      // Pass API key as metadata for authentication
      'temporal-namespace': namespace,
      authorization: `Bearer ${apiKey}`,
    },
  });

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace,
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'webpage-change-detector',
  });

  console.log('Worker started successfully!');
  console.log(`Connected to: ${address}`);
  console.log(`Namespace: ${namespace}`);
  console.log(`Task Queue: webpage-change-detector`);

  // Run the worker
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
