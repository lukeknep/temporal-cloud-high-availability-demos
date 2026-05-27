variable "namespace_name" {
  description = "Name of the Temporal Cloud namespace to create (without the account suffix)."
  type        = string
  default     = "terraform-import-demo"
}

variable "retention_days" {
  description = "Number of days to retain workflow history."
  type        = number
  default     = 14
}

variable "region" {
  description = "Region for the namespace (cloud-prefixed, e.g. aws-us-east-1)."
  type        = string
  default     = "aws-us-east-1"
}
