#!/bin/bash

apt update -y

apt install -y nodejs npm git default-mysql-client

cd /home

git clone https://github.com/Ryan-Holden/gallery-terraform.git

cd gallery-terraform/backend

npm install

mkdir -p public

cp -r ../frontend/* public/

cat > .env <<EOF
DB_HOST=${db_host}
DB_USER=root
DB_PASSWORD=${db_password}
DB_NAME=gallerydb
EOF

cat > init.sql <<EOF
CREATE DATABASE IF NOT EXISTS gallerydb;

USE gallerydb;

CREATE TABLE IF NOT EXISTS photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255)
);
EOF

mysql -h ${db_host} -u root -p${db_password} < init.sql

sed -i '1i app.use(express.static("public"));' server.js

npm install -g pm2

pm2 start server.js --name gallery-app

pm2 save

pm2 startup systemd -u root --hp /root