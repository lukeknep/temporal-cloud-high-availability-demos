output "namespace_id" {
  description = "Fully-qualified namespace ID."
  value       = temporalcloud_namespace.demo.id
}

output "endpoints" {
  description = "gRPC endpoint(s) for the namespace."
  value       = temporalcloud_namespace.demo.endpoints
}
