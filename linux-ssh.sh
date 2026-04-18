#!/bin/bash
# VPS Auto-Setup Script (Ngrok Removed - No Auth Required)

if [[ -z "$LINUX_USER_PASSWORD" ]]; then
  LINUX_USER_PASSWORD="cybervps123"
fi
if [[ -z "$LINUX_USERNAME" ]]; then
  LINUX_USERNAME="runner"
fi

sudo useradd -m $LINUX_USERNAME || true
sudo adduser $LINUX_USERNAME sudo || true
echo "$LINUX_USERNAME:$LINUX_USER_PASSWORD" | sudo chpasswd
sed -i 's/\/bin\/sh/\/bin\/bash/g' /etc/passwd
sudo hostname ${LINUX_MACHINE_NAME:-FreeVPS} || true

echo "### Installing OpenSSH Server ###"
sudo apt-get update -y
sudo apt-get install -y openssh-server tar wget curl
sudo service ssh start

echo "### Setting up bore tunnel (Free, No Auth Required) ###"
wget -q https://github.com/ekzhang/bore/releases/download/v0.5.1/bore-v0.5.1-x86_64-unknown-linux-musl.tar.gz
tar -xf bore-v0.5.1-x86_64-unknown-linux-musl.tar.gz
chmod +x bore

rm -f bore.log
./bore local 22 --to bore.pub > bore.log 2>&1 &

sleep 6
PORT=$(grep -o -E "bore.pub:[0-9]+" bore.log | cut -d ':' -f 2 | head -n 1)

echo ""
echo "=========================================="
if [ -n "$PORT" ]; then
  echo "To connect to your Free VPS:"
  echo "ssh $LINUX_USERNAME@bore.pub -p $PORT"
  echo "Password: $LINUX_USER_PASSWORD"
else
  echo "Failed to start tunnel. Log dump:"
  cat bore.log
fi
echo "=========================================="
