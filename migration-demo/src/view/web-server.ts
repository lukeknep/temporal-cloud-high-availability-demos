// src/web-server.ts
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Connection, Client } from '@temporalio/client';
import { WCDQueryResult, WCDWorkflowParams } from '../types';
import { getStatusQuery, webpageChangeDetectorWorkflow } from '../temporal/workflows'

const app = express();
const PORT = process.env.PORT || 3000;

let temporalClient: Client;

// Initialize Temporal client
async function initTemporalClient() {
  // Read config file
  const configPath = path.join(__dirname, '..', '..', 'config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);
  
  const { temporal } = config;

  const connection = await Connection.connect({
    address: temporal.address,
    tls: temporal.apiKey ? true : undefined,
    apiKey: temporal.apiKey || undefined,
    metadata: temporal.apiKey ? {
      'temporal-namespace': temporal.namespace,
    } : undefined,
  });

  temporalClient = new Client({
    connection,
    namespace: temporal.namespace,
  });

  console.log(`Temporal client connected to ${temporal.address}, namespace: ${temporal.namespace}`);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// API endpoint to query workflow stats
app.get('/api/workflows/:workflowId/stats', async (req, res) => {
  try {
    const { workflowId } = req.params;

    if (!workflowId) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    const handle = temporalClient.workflow.getHandle(workflowId);
    const results: WCDQueryResult = await handle.query(getStatusQuery);

    res.json(results);
  } catch (error: any) {
    console.error('Error querying workflow:', error);
    res.status(500).json({
      error: 'Failed to query workflow',
      message: error.message
    });
  }
});

// API endpoint to start a new workflow
app.post('/api/workflows/start', async (req, res) => {
  try {
    const { id, url, sleepInterval } = req.body as WCDWorkflowParams;

    // Validate input
    if (!id || !url || !sleepInterval) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'id, url, and sleepInterval are required'
      });
    }

    if (typeof sleepInterval !== 'number' || sleepInterval <= 0) {
      return res.status(400).json({
        error: 'Invalid sleepInterval',
        message: 'sleepInterval must be a positive number'
      });
    }

    // Start the workflow
    const handle = await temporalClient.workflow.start(webpageChangeDetectorWorkflow, {
      taskQueue: 'webpage-change-detector',
      workflowId: id,
      args: [{ id, url, sleepInterval }],
      workflowTaskTimeout: '120s',
    });

    res.json({
      success: true,
      workflowId: handle.workflowId,
      message: 'Workflow started successfully'
    });
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    res.status(500).json({
      error: 'Failed to start workflow',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function start() {
  try {
    await initTemporalClient();

    app.listen(PORT, () => {
      console.log(`Web server running at http://localhost:${PORT}`);
      console.log(`Open your browser to view the latency monitor dashboard`);
    });
  } catch (error) {
    console.error('Failed to start web server:', error);
    process.exit(1);
  }
}

start();
