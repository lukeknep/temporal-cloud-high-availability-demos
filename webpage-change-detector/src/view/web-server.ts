// src/web-server.ts
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Connection, Client } from '@temporalio/client';
import { WCDQueryResult } from '../types';
import { getStatusQuery } from '../temporal/workflows'

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
    apiKey: temporal.apiKey,
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
