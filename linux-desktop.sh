#!/bin/bash
# Linux Desktop Auto-Setup (Optimized)
export DEBIAN_FRONTEND=noninteractive

if [[ -f "/tmp/vps_desktop_running" ]]; then
  echo "Desktop setup already in progress or completed."
  exit 0
fi
touch /tmp/vps_desktop_running

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

echo "### Installing Desktop Environment (If missing) ###"
if ! command -v xfce4-session &> /dev/null; then
    echo "Installing Desktop (This may take several minutes)..."
    sudo apt-get update -y
    wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
    sudo dpkg --install chrome-remote-desktop_current_amd64.deb || sudo apt install --assume-yes --fix-broken -y
    sudo DEBIAN_FRONTEND=noninteractive apt install --assume-yes xfce4 desktop-base
    sudo bash -c 'echo "exec /etc/X11/Xsession /usr/bin/xfce4-session" > /etc/chrome-remote-desktop-session'  
    sudo apt install --assume-yes xscreensaver
    sudo systemctl disable lightdm.service || true
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo dpkg --install google-chrome-stable_current_amd64.deb || sudo apt install --assume-yes --fix-broken -y
    sudo apt install nautilus nano gdebi firefox tightvncserver openssh-server tar wget curl -y
fi

sudo hostname ${LINUX_MACHINE_NAME:-FreeVPS} || true
sudo adduser $LINUX_USERNAME chrome-remote-desktop || true
sudo mkdir -p /var/run/sshd
sudo service ssh start || sudo /usr/sbin/sshd &

echo -e "no\n$LINUX_USER_PASSWORD\n$LINUX_USER_PASSWORD" | tightvncserver :1 || true

if [[ -n "$CHROME_HEADLESS_CODE" && -n "$GOOGLE_REMOTE_PIN" ]]; then
   echo "Starting Chrome Remote Desktop..."
   echo -e "$GOOGLE_REMOTE_PIN\n$GOOGLE_REMOTE_PIN" | su - $LINUX_USERNAME -c "$CHROME_HEADLESS_CODE" || true
fi

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
  echo "To connect to your Free VPS (Terminal):"
  echo "ssh $LINUX_USERNAME@bore.pub -p $PORT"
  echo "Password: $LINUX_USER_PASSWORD"
fi
echo "To connect via Desktop:"
echo "Use Chrome Remote Desktop: https://remotedesktop.google.com/access"
echo "=========================================="
