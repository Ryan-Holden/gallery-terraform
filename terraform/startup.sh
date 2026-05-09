#!/bin/bash

exec > /tmp/startup-script.log 2>&1

DB_HOST=$(curl -H "Metadata-Flavor: Google" \
http://metadata.google.internal/computeMetadata/v1/instance/attributes/db_host)

DB_PASSWORD=$(curl -H "Metadata-Flavor: Google" \
http://metadata.google.internal/computeMetadata/v1/instance/attributes/db_password)

apt update -y

apt install -y nodejs npm git default-mysql-client

cd /home

git clone https://github.com/Ryan-Holden/gallery-terraform.git

cd /home/gallery-terraform/backend

npm install

mkdir -p public

cp -r ../frontend/* public/

cat > .env <<EOF
DB_HOST=$DB_HOST
DB_USER=root
DB_PASSWORD=$DB_PASSWORD
DB_NAME=gallerydb
EOF

echo "Waiting for Cloud SQL..."

sleep 90

cat > init.sql <<EOF
CREATE DATABASE IF NOT EXISTS gallerydb;

USE gallerydb;

CREATE TABLE IF NOT EXISTS photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255)
);
EOF

mysql -h $DB_HOST -u root -p$DB_PASSWORD < init.sql

npm install -g pm2

pm2 start server.js --name gallery-app

pm2 save