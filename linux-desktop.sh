#!/bin/bash
# Linux Desktop Auto-Setup (Ngrok Removed)
export DEBIAN_FRONTEND=noninteractive

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
sudo apt-get update -y

echo "### Installing Desktop Environment ###"
wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
sudo dpkg --install chrome-remote-desktop_current_amd64.deb || sudo apt install --assume-yes --fix-broken -y
sudo DEBIAN_FRONTEND=noninteractive apt install --assume-yes xfce4 desktop-base
sudo bash -c 'echo "exec /etc/X11/Xsession /usr/bin/xfce4-session" > /etc/chrome-remote-desktop-session'  
sudo apt install --assume-yes xscreensaver
sudo systemctl disable lightdm.service || true
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg --install google-chrome-stable_current_amd64.deb || sudo apt install --assume-yes --fix-broken -y
sudo apt install nautilus nano gdebi firefox tightvncserver openssh-server tar wget curl -y

sudo hostname ${LINUX_MACHINE_NAME:-FreeVPS} || true
sudo adduser $LINUX_USERNAME chrome-remote-desktop
sudo service ssh start

echo -e "no\n$LINUX_USER_PASSWORD\n$LINUX_USER_PASSWORD" | tightvncserver :1 || true

if [[ -n "$CHROME_HEADLESS_CODE" && -n "$GOOGLE_REMOTE_PIN" ]]; then
   echo "Starting Chrome Remote Desktop..."
   echo -e "$GOOGLE_REMOTE_PIN\n$GOOGLE_REMOTE_PIN" | su - $LINUX_USERNAME -c "$CHROME_HEADLESS_CODE" || true
fi

echo "### Setting up bore tunnel for SSH ###"
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
  echo "To connect to your Free VPS (Terminal):"
  echo "ssh $LINUX_USERNAME@bore.pub -p $PORT"
  echo "Password: $LINUX_USER_PASSWORD"
fi
echo "To connect via Desktop:"
echo "Use Chrome Remote Desktop: https://remotedesktop.google.com/access"
echo "=========================================="
