output "vm_external_ip" {
  value = google_compute_instance.vm_instance.network_interface[0].access_config[0].nat_ip
}

output "database_private_ip" {
  value = google_sql_database_instance.mysql.private_ip_address
}