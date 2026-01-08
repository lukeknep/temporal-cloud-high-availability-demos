import { Connection, Client, WorkflowNotFoundError } from '@temporalio/client';
import { webpageChangeDetectorWorkflow, getStatusQuery } from './workflows';
import { WCDWorkflowParams, WCDQueryResult } from '../types';
import fs from 'fs';
import path from 'path';

async function run() {
  // Read config file
  const configPath = path.join(__dirname, '..', 'config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);

  const { address, namespace, apiKey } = config.temporal;

  // Create connection to Temporal Cloud
  const connection = await Connection.connect({
    address,
    tls: {
      clientCertPair: undefined,
    },
    metadata: {
      'temporal-namespace': namespace,
      authorization: `Bearer ${apiKey}`,
    },
  });

  const client = new Client({
    connection,
    namespace,
  });

  // Example: Start a workflow
  const workflowParams: WCDWorkflowParams = {
    id: 'example-monitor',
    url: 'https://example.com',
    sleepInterval: 60, // Check every 60 seconds
  };

  const workflowId = `wcd-${workflowParams.id}`;

  try {
    // Try to start the workflow
    const handle = await client.workflow.start(webpageChangeDetectorWorkflow, {
      taskQueue: 'webpage-change-detector',
      workflowId,
      args: [workflowParams],
    });

    console.log(`Started workflow: ${workflowId}`);
    console.log(`Monitoring URL: ${workflowParams.url}`);
    console.log(`Check interval: ${workflowParams.sleepInterval} seconds`);

    // Wait a moment and then query the workflow
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const result: WCDQueryResult = await handle.query(getStatusQuery);
    console.log('\nInitial status:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    if (error.message?.includes('WorkflowExecutionAlreadyStarted')) {
      console.log(`Workflow ${workflowId} is already running`);

      // Get handle to existing workflow
      const handle = client.workflow.getHandle(workflowId);

      // Query the existing workflow
      const result: WCDQueryResult = await handle.query(getStatusQuery);
      console.log('\nCurrent status:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      throw error;
    }
  }
}

run().catch((err) => {
  console.error('Client error:', err);
  process.exit(1);
});
