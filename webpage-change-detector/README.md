# Webpage Change Detector - High Availability Failover Demo

This demo application showcases Temporal's multi-region failover capabilities using a webpage change detection workflow. The application continuously monitors webpages for content changes and records latency metrics, demonstrating how Temporal Workflows maintain state and continue execution seamlessly during region failovers.

## Get Started

### Setup

First, select a Namespace with Multi-region or Multi-cloud Replication enabled (that is, with a replica in a different region or cloud).

If you don't already have such a Namespace, you can create one or add a replica to an existing one.

This demo uses API keys. Create an API key for your Namespace and save it securely.

Then, in the `webpage-change-detector` directory:

1. Install dependencies: `npm i`

1. Copy the example configuration file: `cp example.config.json config.json`

1. Edit `config.json` with your Temporal Cloud credentials:
   - `temporal.namespace`: Your Namespace ID
   - `temporal.address`: Your Namespace endpoint
   - `temporal.apiKey`: Your API key

1. Start a Worker: `npm run worker`

Then run Workflows on it! A quick test is below:

### Test Workflows

Set up the API Key, Namespace ID, and Endpoint that you wish to use with environment variables. 
This is how you would set environment variables that use the same values from `config.json` which you edited earlier.

```
export API_KEY=$(jq -r '.temporal.apiKey' config.json)
export NAMESPACE=$(jq -r '.temporal.namespace' config.json)
export ADDRESS=$(jq -r '.temporal.address' config.json)

echo "\n\nConnecting to $NAMESPACE using the address $ADDRESS and API key starting with ${API_KEY:0:5}\n"
```

(Sanity check: did that echo statement print out the expected values?)

Note: Using `export` in this way will save the values of these variables in your Terminal window. If you open a new Terminal window, you will need to run these again.

To double check that you can connect to Temporal Cloud as expected, let's list the Workflows:

```
temporal workflow list \
  --namespace "$NAMESPACE" \
  --address "$ADDRESS" \
  --api-key "$API_KEY"
```

If you haven't used this Namespace before, that command will probably return nothing (anti-climactic, I know). That's ok. We just want to check that it succeeds and doesn't show an error.

Now start a Workflow. This command starts one that checks the Federal Reserve's news release website for changes:

```
temporal workflow start \
  --namespace "$NAMESPACE" \
  --address "$ADDRESS" \
  --api-key "$API_KEY" \
  --task-queue webpage-change-detector \
  --type webpageChangeDetectorWorkflow \
  --workflow-id fed \
  --input '{
    "id": "fed",
    "url": "https://www.federalreserve.gov/newsevents.htm",
    "sleepInterval": 20
  }'
```

You can check the Worker logs for any errors. Then, check the web app to visualize results!

If you hit errors / bugs and make changes, I recommend canceling that Workflow and running a new one, incrementing the last character of the Workflow ID to `B`, then `C`, etc. 

When you want to stop the monitor, cancel the Workflow:

```
temporal workflow cancel \
  --namespace "$NAMESPACE" \
  --address "$ADDRESS" \
  --api-key "$API_KEY" \
  --workflow-id fed
```



## Multi-region Failover Demos

### Executing a Multi-region Failover with the CLI

We will use CLI commands to run Workers, Workflows, and Failovers.

Prereq: You will need VMs to run the Workers. I recommend two VMs in different regions, matching your Namespace's active region and replica regions. An easy way to do this is with AWS Lightsail: Pick a region > Pick a cheap instance type > Pick the "NodeJS" starter to configure the VM with everything you need to run a Worker in Typescript.

1. Start a Worker in the active region of your Namespace. 

  * Launch the VM

  * Add `git` and `npm` to the VM, if not already installed. For Amazon Lightsail, it will already have `npm` but you will need to install git: `sudo apt update && sudo apt install git-all`

  * `git clone` this repo and `cd` into the `webpage-change-detector` directory

  * `npm i`

  * Copy your `config.json` to it (e.g., `vi config.json`, then `i` for insert, then `Cmd + V` to paste the content)

  * Start the Worker: `npm run worker`

1. Start Workflows to monitor several different webpages (hosted in different regions):

  * AWS us-east-1

  ```
  temporal workflow start \
    --namespace "$NAMESPACE" \
    --address "$ADDRESS" \
    --api-key "$API_KEY" \
    --task-queue webpage-change-detector \
    --type webpageChangeDetectorWorkflow \
    --workflow-id ha-demo-us-east-1 \
    --input '{
      "id": "ha-demo-us-east-1",
      "url": "https://ha-demo-us-east-1.s3.amazonaws.com/hello.txt",
      "sleepInterval": 10
    }'
  ```

  * AWS us-west-2 

  ```
  temporal workflow start \
  --namespace "$NAMESPACE" \
  --address "$ADDRESS" \
  --api-key "$API_KEY" \
  --task-queue webpage-change-detector \
  --type webpageChangeDetectorWorkflow \
  --workflow-id ha-demo-us-west-2 \
  --input '{
    "id": "ha-demo-us-west-2",
    "url": "https://ha-demo-us-west-2.s3.amazonaws.com/hello.txt",
    "sleepInterval": 10
  }'
  ```


  * AWS ap-northeast-1 (Tokyo)

  ```
  temporal workflow start \
  --namespace "$NAMESPACE" \
  --address "$ADDRESS" \
  --api-key "$API_KEY" \
  --task-queue webpage-change-detector \
  --type webpageChangeDetectorWorkflow \
  --workflow-id ha-demo-ap-northeast-1 \
  --input '{
    "id": "ha-demo-ap-northeast-1",
    "url": "https://ha-demo-ap-northeast-1.s3.amazonaws.com/hello.txt",
    "sleepInterval": 10
  }'
  ```

1. Simulate a cloud region outage in the active region. Since we can't actually bring down AWS in that region, we will instead (1) crash the Worker and (2) initiate the failover command for the Namespace:

   1. Crash the Worker: Find its PID with `ps aux | grep worker` and kill it with `sudo kill -9 <PID>`

   2. Initiate the Namespace failover:
   ```
   tcld namespace failover \
     --namespace "$NAMESPACE" \
     --cluster <replica-cluster-name>
   ```
   Replace `<replica-cluster-name>` with the name of your replica cluster (e.g., `us-west-2-aws`)

1. Launch a Worker in the replica's region:
   * SSH into the VM in the replica region
   * Follow the same setup steps from step 1 to clone the repo, install dependencies, and configure `config.json`
   * Start the Worker: `npm run worker`

1. Observe that Workflows continue to run and that their state was preserved during the failover:
   * Check the Temporal Cloud Web UI to see Workflow history
   * Monitor the web app to see that webpage checks continue without interruption
   * Note that latency values may change as requests now originate from the new region

## Cleanup

After completing the demo:

1. Terminate all running Workflows:

  ```
  temporal workflow terminate --reason "cleanup" \
    --namespace "$NAMESPACE" \
    --address "$ADDRESS" \
    --api-key "$API_KEY" \
    --workflow-id ha-demo-ap-northeast-1

  temporal workflow terminate --reason "cleanup" \
    --namespace "$NAMESPACE" \
    --address "$ADDRESS" \
    --api-key "$API_KEY" \
    --workflow-id ha-demo-us-east-1

  temporal workflow terminate --reason "cleanup" \
    --namespace "$NAMESPACE" \
    --address "$ADDRESS" \
    --api-key "$API_KEY" \
    --workflow-id ha-demo-us-west-2
  ```

2. Stop the Workers running on your VMs

3. Shut down or terminate your VMs to avoid ongoing charges

## Troubleshooting

* "I've changed the Workflow code but I already have several Workflows in progress."
  > An easy way to get around this is to terminate the Workflows and then restart the Worker process.

* "Non-deterministic Workflow error"
  > You may have changed the Workflow code while Workflows were running. Try the step above.

* `Error: Cannot find module '../lib/tsc.js'`
  > This is usually caused by corrupted dependencies. Remove the `node_modules` directory and reinstall: `rm -rf node_modules && npm i`