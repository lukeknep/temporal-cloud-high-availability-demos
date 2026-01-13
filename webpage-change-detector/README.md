# Webpage Change Monitor - HA Failover Demo

## Get started

### Setup

First, select a Namespace with Multi-region or Multi-cloud Replication turned on (that is, with a replica in a different region or cloud).

If you don't already have such a Namespace, then you can create one, or add a replica to an existing one.

This demo uses API keys. Create an API key for your Namespace and save it.

Then, in the `latency-monitor` directory:

1. `npm i` to install dependencies

1. copy example.config.json to config.json: `cp example.config.json config.json`

1. Edit `config.json` with your app's values for your Namespace (ID, Endpoint, API key) and your SMTP Gmail info

1. Start a Worker with `npm run worker`

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

If you haven't used this Namesapce before, that command will probably return nothing (anti-climactic, I know)  That's ok. We just want to check that it succeeds and doesn't show an error.

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

You can check the Worker tab to look for any errors. Then, checkthe web app to visualize results!

If you hit errors / bugs and make changes, I recommend canceling that Workflow and running a new one, incrementing the last character of the Workflow ID to `B`, then `C`, etc. 

When you want to stop the monitor, cancel the Workflow:

```
temporal workflow cancel \
  --namespace "$NAMESPACE" \
  --address "$ADDRESS" \
  --api-key "$API_KEY" \
  --workflow-id us-east-1-A
```



## Multi-region Failover Demos

### Executing a Multi-region Failover with the CLI

We will use CLI commands to run Workers, Workflows, and Failovers.

Prereq: You will need VMs to run the Workers. I recommend two VMs in different regions, matching your Namespace's active region and replica regions. An easy way to do this is with AWS Lightsail: Pick a region > Pick a cheap instance type > Pick the "NodeJS" starter to configure the VM with everything you need to run a Worker in Typescript.

1. Start a Worker in the active region of your Namespace. 

  * Launch the VM

  * Add `git` and `npm` to the VM, if not already installed. For Amazon Lightsail, it will already have `npm` but you will need to install git: `sudo apt update & sudo apt install git-all`

  * `git clone` this repo and `cd` into latency monitor directory

  * `npm i`

  * Copy your `config.json` to it (e.g., `vi config.json`, then `i` for insert, then `Cmd + V` to paste the content)

  * 

1. Start Workflows to monitor the latency for several different regions:

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
    "url": "https://s3.us-west-2.amazonaws.com",
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
    "url": "https://s3.ap-northeast-1.amazonaws.com",
    "sleepInterval": 10
  }'
  ```

1. Simulate a cloud region outage in the active region. 
Since we can't actually bring down AWS in that region, we will instead 1. crash the worker, 2. initiate the failover command for the Namespace
  
   1. crash the worker: (TODO: Find it's pid and `sudo kill -9` the pid)

   2. initiate the Namespace failover: (TODO)

1. Launch a Worker in the replica's region (TODO)

1. Observe that Workflows continue to run, and that their state was preserved on the failover (TODO)

## Cleanup

1. Terminate the Workflows
  
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

## Troubleshooting

* "I've changed the Wrokflow code but I already have several Workflows in progress."
  > An easy way to get around this is to terminate the Workflows and then restart the Worker process.

* "Non-deterministic Workflow error"
  > You may have changed the Workflow code while Workflows were running. Try the step above.

* `Error: Cannot find module '../lib/tsc.js'`
   Try removing the node_modules directory and running `npm i` again.