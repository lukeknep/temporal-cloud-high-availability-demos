# ---------------------------------------------------------------------------
# Single-region namespace (no replica)
#
# Start here. After applying, follow the README to add a replica via CLI
# and then update this file to bring Terraform back in sync.
# ---------------------------------------------------------------------------
resource "temporalcloud_namespace" "demo" {
  name    = var.namespace_name
  regions = [var.region]

  api_key_auth   = true
  retention_days = var.retention_days
}
