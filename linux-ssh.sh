# VPS Auto-Setup Script (Optimized)

if [[ -f "/tmp/vps_running" ]]; then
  echo "VPS setup already in progress or completed."
  exit 0
fi
touch /tmp/vps_running

if [[ -z "$LINUX_USER_PASSWORD" ]]; then
  LINUX_USER_PASSWORD="cybervps123"
fi
if [[ -z "$LINUX_USERNAME" ]]; then
  LINUX_USERNAME="runner"
fi

echo "### Setting up User ###"
sudo useradd -m $LINUX_USERNAME || true
sudo adduser $LINUX_USERNAME sudo || true
echo "$LINUX_USERNAME:$LINUX_USER_PASSWORD" | sudo chpasswd
sed -i 's/\/bin\/sh/\/bin\/bash/g' /etc/passwd
sudo hostname ${LINUX_MACHINE_NAME:-FreeVPS} || true

echo "### Checking for SSH ###"
if ! command -v sshd &> /dev/null; then
    echo "Installing SSH..."
    sudo apt-get update -y
    sudo apt-get install -y openssh-server tar wget curl
fi

# Ensure SSH directory exists for the runner
sudo mkdir -p /var/run/sshd
sudo chmod 0755 /var/run/sshd

# Start SSH without systemd if needed
sudo service ssh start || sudo /usr/sbin/sshd &

echo "### Setting up bore tunnel ###"
if [[ ! -f "./bore" ]]; then
    wget -q https://github.com/ekzhang/bore/releases/download/v0.5.1/bore-v0.5.1-x86_64-unknown-linux-musl.tar.gz
    tar -xf bore-v0.5.1-x86_64-unknown-linux-musl.tar.gz
    chmod +x bore
fi

# Kill old bore if exists
pkill bore || true
rm -f bore.log

# Start bore and keep it alive
nohup ./bore local 22 --to bore.pub > bore.log 2>&1 &

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
