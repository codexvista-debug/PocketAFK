#!/data/data/com.termux/files/usr/bin/bash
# PocketAFK 1-Click Termux Launch Script

echo -e "\e[1;32m"
echo "╔═══════════════════════════════════════════════════╗"
echo "║          🚀 PocketAFK Termux Launcher             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "\e[0m"

# 1. Acquire Termux wake lock so Android does not sleep
termux-wake-lock 2>/dev/null

# 2. Check and start daemon in the background
echo -e "\e[1;34m[1/3] Starting PocketAFK Daemon on port 8080...\e[0m"
npm run start > daemon.log 2>&1 &
DAEMON_PID=$!
sleep 2

# 3. Start Cloudflare Tunnel
echo -e "\e[1;34m[2/3] Launching Cloudflare Tunnel...\e[0m"
cloudflared tunnel --url http://127.0.0.1:8080 > tunnel.log 2>&1 &
TUNNEL_PID=$!

echo -e "\e[1;33m[3/3] Waiting for your secure public tunnel URL...\e[0m"
sleep 4

TUNNEL_URL=""
for i in {1..20}; do
  TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' tunnel.log | head -n 1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -n "$TUNNEL_URL" ]; then
  WSS_URL=$(echo "$TUNNEL_URL" | sed 's/https:/wss:/')
  echo ""
  echo -e "\e[1;32m════════════════════════════════════════════════════\e[0m"
  echo -e "\e[1;32m  🎉 YOUR POCKETAFK TUNNEL IS LIVE! \e[0m"
  echo -e "\e[1;32m════════════════════════════════════════════════════\e[0m"
  echo ""
  echo -e "Copy this URL and paste it into \e[1;36mSettings\e[0m on your website:"
  echo -e "\e[1;33m$WSS_URL\e[0m"
  echo ""
  echo -e "\e[1;30m(Press Ctrl+C to stop both the daemon and the tunnel)\e[0m"
  echo ""
else
  echo -e "\e[1;31mCould not extract tunnel URL automatically. Check tunnel.log:\e[0m"
  cat tunnel.log | grep -E "https://.*trycloudflare.com"
fi

# Trap Ctrl+C to kill background processes
trap "kill $DAEMON_PID $TUNNEL_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
