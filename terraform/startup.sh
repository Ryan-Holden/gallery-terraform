#!/bin/bash
set -x

exec > /tmp/startup-script.log 2>&1

export DEBIAN_FRONTEND=noninteractive

apt update -y

apt install -y git curl

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

apt install -y nodejs

cd /home

if [ ! -d "/home/gallery-terraform" ]; then
    git clone https://github.com/Ryan-Holden/gallery-terraform.git
fi

cd /home/gallery-terraform/backend

npm install

mkdir -p public

cp -r ../frontend/* public/

npm install -g pm2

pm2 start server.js --name gallery-app

pm2 save

pm2 startup systemd -u root --hp /root