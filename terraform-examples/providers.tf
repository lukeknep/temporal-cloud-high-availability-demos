terraform {
  required_providers {
    temporalcloud = {
      source  = "temporalio/temporalcloud"
      version = ">= 0.6.0"
    }
  }
}

# Credentials are read from environment variables:
#   export TEMPORAL_CLOUD_API_KEY="<your-api-key>"
provider "temporalcloud" {}
