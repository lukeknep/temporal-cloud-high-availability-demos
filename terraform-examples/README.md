# Adding Multi-region Replication to a Terraform-managed Namespace

This example walks through a common scenario: you have a Namespace managed by Terraform, and you want to add a replica region. Instead of making the change entirely through Terraform, you add the replica using the Temporal CLI first, and then update Terraform to match.

This approach is useful when you want to add replication to an existing Namespace without recreating it, or when someone has already added a replica outside of Terraform and you need to reconcile the drift.

---

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [Temporal CLI](https://docs.temporal.io/cli) (`temporal`)
- A Temporal Cloud account with a User API key (Account Owner, Global Admin, or Developer role)
- `jq` installed

---

## Step 1: Create a single-region Namespace with Terraform

```bash
cd terraform-examples

# Set your Temporal Cloud API key
export TEMPORAL_CLOUD_API_KEY=$(jq -r '.temporal.cloudOpsAPIKey' config.json)

# Initialize and apply
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

This creates a Namespace in `aws-us-east-1` with no replica. Verify it:

```bash
terraform output namespace_id
terraform output endpoints
```

---

## Step 2: Add a replica using the Temporal CLI

Now add a second region to the Namespace outside of Terraform:

```bash
NAMESPACE_ID=$(terraform output -raw namespace_id)

temporal cloud namespace update \
  --namespace "$NAMESPACE_ID" \
  --region aws-us-west-2 \
  --api-key "$TEMPORAL_CLOUD_API_KEY"
```

At this point, the Namespace has two regions (`aws-us-east-1` and `aws-us-west-2`), but Terraform only knows about one. Running `terraform plan` would show drift — Terraform would propose **removing** the replica to match its config.

You can verify this:

```bash
terraform plan
```

You'll see something like:

```
~ regions = [
    "aws-us-east-1",
  - "aws-us-west-2",
  ]
```

**Do not apply this plan** — it would remove the replica you just added.

---

## Step 3: Update the Terraform configuration

Edit `main.tf` to include the replica region:

```hcl
resource "temporalcloud_namespace" "demo" {
  name    = var.namespace_name
  regions = [var.region, "aws-us-west-2"]

  api_key_auth   = true
  retention_days = var.retention_days
}
```

Or, for a more flexible approach, add a variable in `variables.tf`:

```hcl
variable "replica_region" {
  description = "Replica region for HA (cloud-prefixed). Leave empty for single-region."
  type        = string
  default     = "aws-us-west-2"
}
```

And update `main.tf`:

```hcl
resource "temporalcloud_namespace" "demo" {
  name    = var.namespace_name
  regions = [var.region, var.replica_region]

  api_key_auth   = true
  retention_days = var.retention_days
}
```

---

## Step 4: Verify Terraform sees no drift

```bash
terraform plan
```

If the config matches reality, you'll see:

```
No changes. Your infrastructure matches the configuration.
```

Terraform's state is now in sync with both the config files and the actual Namespace. Future `terraform apply` runs will preserve the replica.

---

## Why not just import?

A common instinct is to run `terraform import` to fix the drift. But `terraform import` only updates the **state file** — it does not update your `.tf` configuration files. If you import without updating the HCL, the next `terraform plan` will still propose removing the replica (because the config says single-region).

The correct sequence is always:

1. Update the `.tf` files to match reality
2. Run `terraform plan` to confirm no drift
3. If state is stale, use `terraform apply -refresh-only` to refresh it

`terraform import` is only needed when a resource exists in the cloud but is not tracked in state at all (e.g., someone created it entirely outside Terraform).

---

## Teardown

```bash
terraform destroy
```

---

## Files

```
terraform-examples/
├── config.json        # Temporal Cloud credentials (git-ignored in practice)
├── example.config.json# Template showing required fields
├── providers.tf       # Terraform + provider version requirements
├── variables.tf       # Input variables (region, retention, etc.)
├── main.tf            # Namespace resource (start single-region, add replica)
├── outputs.tf         # Namespace ID and endpoints
└── README.md          # This file
```
