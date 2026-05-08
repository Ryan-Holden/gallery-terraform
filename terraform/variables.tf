variable "project_id" {
  type = string

  validation {
    condition     = length(var.project_id) > 3
    error_message = "Project ID must be longer than 3 characters."
  }
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "db_password" {
  type      = string
  sensitive = true

  validation {
    condition     = length(var.db_password) >= 8
    error_message = "Database password must be at least 8 characters."
  }
}