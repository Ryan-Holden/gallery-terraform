resource "google_compute_network" "vpc" {
  name                    = "gallery-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "gallery-subnet"
  ip_cidr_range = "10.0.0.0/16"
  network       = google_compute_network.vpc.id
  region        = var.region
}

resource "google_compute_firewall" "allow_http" {
  name    = "allow-http"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3000"]
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_service_account" "gallery_sa" {
  account_id   = "gallery-service-account"
  display_name = "Gallery Service Account"
}

resource "google_compute_global_address" "private_ip_address" {
  name          = "gallery-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

resource "google_sql_database_instance" "mysql" {
  name             = "gallery-mysql"
  database_version = "MYSQL_8_0"

  settings {
    tier = "db-n1-standard-1"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
  }

  depends_on = [
    google_service_networking_connection.private_vpc_connection
  ]

  deletion_protection = false
}

resource "google_sql_database" "gallery_db" {
  name     = "gallerydb"
  instance = google_sql_database_instance.mysql.name
}

resource "google_sql_user" "users" {
  name     = "root"
  instance = google_sql_database_instance.mysql.name
  password = var.db_password
}

resource "google_compute_instance" "vm_instance" {
  name         = "gallery-vm"
  machine_type = "e2-standard-2"
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id

    access_config {
    }
  }

  metadata_startup_script = templatefile("startup.sh", {
    db_host     = google_sql_database_instance.mysql.private_ip_address
    db_password = var.db_password
  })

  service_account {
    email  = google_service_account.gallery_sa.email
    scopes = ["cloud-platform"]
  }

  tags = ["gallery-server"]
}

resource "google_project_iam_member" "compute_admin" {
  project = var.project_id
  role    = "roles/compute.viewer"
  member  = "serviceAccount:${google_service_account.gallery_sa.email}"
}

resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.gallery_sa.email}"
}