// src/web-server.ts
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Connection, Client } from '@temporalio/client';
import { WCDQueryResult, WCDWorkflowParams } from '../types';
import { getStatusQuery, webpageChangeDetectorWorkflow } from '../temporal/workflows'
import {
  SEED_URLS,
  SEED_SLEEP_INTERVAL,
  measureLatency,
  buildHistory,
  randomWorkflowId,
} from '../seed-utils';

const app = express();
const PORT = process.env.PORT || 3000;

interface TemporalTarget {
  address: string;
  namespace: string;
  apiKey?: string;
}

const CLOUD_API_VERSION = 'v0.16.0';
const CLOUD_API_HOST = 'https://saas-api.tmprl.cloud';

let temporalClient: Client;
let cloudOpsApiKey: string | null = null;
let cloudNamespace: string | null = null;

async function connectClient(target: TemporalTarget): Promise<Client> {
  const connection = await Connection.connect({
    address: target.address,
    tls: target.apiKey ? true : undefined,
    apiKey: target.apiKey || undefined,
    metadata: target.apiKey ? {
      'temporal-namespace': target.namespace,
    } : undefined,
  });
  return new Client({ connection, namespace: target.namespace });
}

async function initTemporalClients() {
  const configPath = path.join(__dirname, '..', '..', 'config.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);

  const { temporal } = config;

  temporalClient = await connectClient({
    address: temporal.address,
    namespace: temporal.namespace,
    apiKey: temporal.apiKey,
  });
  console.log(`Temporal client connected to ${temporal.address}, namespace: ${temporal.namespace}`);

  if (temporal.cloudOpsAPIKey && temporal.namespace) {
    cloudOpsApiKey = temporal.cloudOpsAPIKey;
    cloudNamespace = temporal.namespace;
    console.log(`Cloud Ops HTTP API configured (namespace: ${cloudNamespace})`);
  } else {
    console.log('Cloud Ops HTTP API not configured (cloudOpsAPIKey / namespace missing)');
  }
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// Query a workflow for its current status.
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

app.post('/api/workflows/start', async (req, res) => {
  try {
    const { id, url, sleepInterval } = req.body as WCDWorkflowParams;

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

    const params: WCDWorkflowParams = { id, url, sleepInterval };

    const handle = await temporalClient.workflow.start(webpageChangeDetectorWorkflow, {
      taskQueue: 'webpage-change-detector',
      workflowId: id,
      args: [params],
      workflowTaskTimeout: '120s',
    });

    res.json({
      success: true,
      workflowId: handle.workflowId,
      message: 'Workflow started'
    });
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    res.status(500).json({
      error: 'Failed to start workflow',
      message: error.message
    });
  }
});

// Seed a batch of workflows with fabricated history so the UI looks like it
// has been running for a while.
app.post('/api/workflows/seed', async (_req, res) => {
  const started: Array<{ id: string; url: string }> = [];
  try {
    for (const url of SEED_URLS) {
      const id = randomWorkflowId();
      const baseLatency = await measureLatency(url);
      const history = buildHistory(baseLatency);

      const params: WCDWorkflowParams = {
        id,
        url,
        sleepInterval: SEED_SLEEP_INTERVAL,
        history,
      };

      await temporalClient.workflow.start(webpageChangeDetectorWorkflow, {
        taskQueue: 'webpage-change-detector',
        workflowId: id,
        args: [params],
        workflowTaskTimeout: '120s',
      });
      started.push({ id, url });
    }
    res.json({ success: true, started });
  } catch (error: any) {
    console.error('Seed failed:', error);
    res.status(500).json({
      error: 'Seed failed',
      message: error.message,
      started,
    });
  }
});

// Describe the configured namespace via the Cloud Ops HTTP API and return the
// raw response body alongside a few convenience fields used by the sidebar UI.
app.get('/api/cloud/namespace', async (_req, res) => {
  try {
    if (!cloudOpsApiKey || !cloudNamespace) {
      return res.status(400).json({
        error: 'Cloud Ops HTTP API not configured',
        message: 'cloudOpsAPIKey and namespace must be set in config.json',
      });
    }

    const url = `${CLOUD_API_HOST}/cloud/namespaces/${encodeURIComponent(cloudNamespace)}`;
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cloudOpsApiKey}`,
        'temporal-cloud-api-version': CLOUD_API_VERSION,
        Accept: 'application/json',
      },
    });

    const text = await upstream.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'Failed to describe namespace',
        status: upstream.status,
        message: typeof body === 'object' ? body?.message ?? body : body,
      });
    }

    const ns = body?.namespace ?? body;
    res.json({
      namespace: ns?.namespace ?? cloudNamespace,
      activeRegion: ns?.activeRegion ?? null,
      state: ns?.state ?? null,
      description: body,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error describing namespace:', error);
    res.status(500).json({
      error: 'Failed to describe namespace',
      message: error.message,
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
    await initTemporalClients();

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
