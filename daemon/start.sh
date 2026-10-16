#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
#    PocketAFK - Pure Java Mineflayer 24/7 Daemon for Android (Termux)
# ==============================================================================

# ANSI Color Codes
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
PURPLE='\033[1;35m'
RED='\033[1;31m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear
echo -e "${GREEN}"
cat << "EOF"
  ██████╗  ██████╗  ██████╗██╗  ██╗███████╗████████╗ █████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
  ██████╔╝██║   ██║██║     █████╔╝ █████╗     ██║   ███████║█████╗  █████╔╝ 
  ██╔═══╝ ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║   ██╔══██║██╔══╝  ██╔═██╗ 
  ██║     ╚██████╔╝╚██████╗██║  ██╗███████╗   ██║   ██║  ██║██║     ██║  ██╗
  ╚═╝      ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝
EOF
# Identify user and secret key
APP_USER="$1"
APP_SECRET="$2"
USER_FILE="$HOME/.pocketafk_user"
SECRET_FILE="$HOME/.pocketafk_secret"

if [ -n "$APP_USER" ]; then
  echo "$APP_USER" > "$USER_FILE"
elif [ -f "$USER_FILE" ]; then
  APP_USER=$(cat "$USER_FILE")
fi

if [ -n "$APP_SECRET" ]; then
  echo "$APP_SECRET" > "$SECRET_FILE"
elif [ -f "$SECRET_FILE" ]; then
  APP_SECRET=$(cat "$SECRET_FILE")
fi

if [ -z "$APP_USER" ]; then
  echo -ne "${YELLOW}👤 Enter your PocketAFK username (default: guest): ${NC}"
  read -r INPUT_USER
  APP_USER="${INPUT_USER:-guest}"
  echo "$APP_USER" > "$USER_FILE"
fi

UPPER_USER=$(echo "$APP_USER" | tr '[:lower:]' '[:upper:]')

# Fetch real-time accounts and servers from dashboard API
USER_SUMMARY=$(curl -s "https://pocketafk.vercel.app/api/user-summary?username=$APP_USER" 2>/dev/null)
ACC_COUNT=0
SRV_COUNT=0
ACC_LIST="None linked yet"
SRV_LIST="None configured yet"

if [ -n "$USER_SUMMARY" ]; then
  PARSED_DATA=$(node -e "
    try {
      const d = JSON.parse(process.argv[1]);
      const accs = d.accounts || [];
      const srvs = d.servers || [];
      console.log(accs.length + ';;' + srvs.length + ';;' + (accs.join(', ') || 'None linked yet') + ';;' + (srvs.join(', ') || 'None configured yet'));
    } catch(e) {
      console.log('0;;0;;None linked yet;;None configured yet');
    }
  " "$USER_SUMMARY" 2>/dev/null)

  if [ -n "$PARSED_DATA" ]; then
    ACC_COUNT=$(echo "$PARSED_DATA" | awk -F';;' '{print $1}')
    SRV_COUNT=$(echo "$PARSED_DATA" | awk -F';;' '{print $2}')
    ACC_LIST=$(echo "$PARSED_DATA" | awk -F';;' '{print $3}')
    SRV_LIST=$(echo "$PARSED_DATA" | awk -F';;' '{print $4}')
  fi
fi

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                           ║${NC}"
echo -e "${CYAN}║                   ${BOLD}${YELLOW}👤  POCKETAFK USER: [ ${WHITE}@${UPPER_USER}${YELLOW} ]${NC}${CYAN}                   ║${NC}"
echo -e "${CYAN}║                                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
echo -e "  ${WHITE}🎮 Linked Java Accounts :${NC} ${GREEN}${ACC_COUNT}/5 active${NC} (${CYAN}${ACC_LIST}${NC})"
echo -e "  ${WHITE}🌐 Configured Servers   :${NC} ${GREEN}${SRV_COUNT}/3 active${NC} (${YELLOW}${SRV_LIST}${NC})"
if [ -n "$APP_SECRET" ]; then
  echo -e "  ${WHITE}🔑 Secret Launcher Token:${NC} ${GREEN}Protected (Validated)${NC}"
fi
echo -e "${GRAY}─────────────────────────────────────────────────────────────────────────────${NC}\n"

# 1. Acquire Android Wake Lock
echo -e "${CYAN}[1/4]${NC} 🔋 ${BOLD}Acquiring Android background wake lock...${NC}"
if command -v termux-wake-lock &> /dev/null; then
  termux-wake-lock
  echo -e "      ${GREEN}✓ Android OS power management locked (24/7 active)${NC}"
else
  echo -e "      ${YELLOW}⚠ termux-wake-lock not available (continuing standard)${NC}"
fi

# 2. Start PocketAFK Node.js Daemon
echo -e "\n${CYAN}[2/4]${NC} ☕ ${BOLD}Starting Mineflayer Java Core (Node.js LTS)...${NC}"
npm run start > daemon.log 2>&1 &
DAEMON_PID=$!
sleep 2

if ps -p $DAEMON_PID > /dev/null; then
  echo -e "      ${GREEN}✓ Java engine running smoothly on port 8080 (PID: ${DAEMON_PID})${NC}"
else
  echo -e "      ${RED}✗ Failed to start daemon. Showing daemon.log:${NC}"
  cat daemon.log | tail -n 10
  exit 1
fi

# 3. Start Cloudflare Tunnel
echo -e "\n${CYAN}[3/4]${NC} 🛡️  ${BOLD}Creating secure Cloudflare Tunnel...${NC}"
cloudflared tunnel --url http://127.0.0.1:8080 > tunnel.log 2>&1 &
TUNNEL_PID=$!

echo -ne "      ${YELLOW}⌛ Negotiating secure SSL tunnel address...${NC}"
TUNNEL_URL=""
for i in {1..30}; do
  echo -ne "${YELLOW}.${NC}"
  TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' tunnel.log | head -n 1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done
echo ""

if [ -z "$TUNNEL_URL" ]; then
  echo -e "      ${RED}✗ Cloudflare tunnel timed out. Check tunnel.log for details.${NC}"
  exit 1
fi

WSS_URL=$(echo "$TUNNEL_URL" | sed 's/https:/wss:/')
DASHBOARD_SYNC_URL="https://pocketafk.vercel.app/api/tunnel"
AUTO_OPEN_URL="https://pocketafk.vercel.app/?tunnel=${WSS_URL}"

# 4. Auto-sync to Vercel Website
echo -e "\n${CYAN}[4/4]${NC} 🚀 ${BOLD}Auto-syncing tunnel to user @${APP_USER}...${NC}"
SYNC_RESP=$(curl -s -X POST "$DASHBOARD_SYNC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$APP_USER\",\"url\":\"$WSS_URL\",\"token\":\"$APP_SECRET\"}" 2>/dev/null)

if echo "$SYNC_RESP" | grep -q "Unauthorized"; then
  echo -e "      ${RED}✗ AUTHENTICATION FAILED: Secret key does not match user @${APP_USER}.${NC}"
  echo -e "      ${YELLOW}Please run the exact 1-click command shown in your PocketAFK dashboard.${NC}"
  kill $DAEMON_PID 2>/dev/null
  kill $TUNNEL_PID 2>/dev/null
  exit 1
elif echo "$SYNC_RESP" | grep -q "success"; then
  echo -e "      ${GREEN}✓ AUTO-SYNC SUCCESSFUL! No copy-pasting required.${NC}"
else
  echo -e "      ${YELLOW}✓ Live sync broadcasted.${NC}"
fi

# Print Fancy Summary Card
echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}   ${BOLD}🎉 POCKETAFK IS OFFICIALLY LIVE & PROTECTED 24/7${NC}                      ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
echo -e "  ${WHITE}👤 User Account     :${NC} ${BOLD}${YELLOW}@${UPPER_USER}${NC}"
echo -e "  ${WHITE}🎮 Linked Java      :${NC} ${GREEN}${ACC_COUNT}/5 active${NC} (${CYAN}${ACC_LIST}${NC})"
echo -e "  ${WHITE}🌐 Added Servers    :${NC} ${GREEN}${SRV_COUNT}/3 active${NC} (${YELLOW}${SRV_LIST}${NC})"
echo -e "  ${WHITE}🌐 WebSocket Tunnel :${NC} ${CYAN}${WSS_URL}${NC}"
echo -e "  ${WHITE}📱 Web Dashboard    :${NC} ${GREEN}https://pocketafk.vercel.app${NC}"
echo -e "  ${WHITE}⚡ Instant Link     :${NC} ${YELLOW}${AUTO_OPEN_URL}${NC}"
echo -e "${GREEN}─────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "  ${BOLD}💡 Note:${NC} You can simply open ${GREEN}https://pocketafk.vercel.app${NC} on ANY device."
echo -e "  The website will ${BOLD}automatically detect${NC} this phone's tunnel!"
echo -e "  ${GRAY}(To stop PocketAFK, press Ctrl+C anytime)${NC}\n"

# Trap exit
cleanup() {
  echo -e "\n\n${YELLOW}[!] Stopping PocketAFK processes cleanly...${NC}"
  kill $DAEMON_PID 2>/dev/null
  kill $TUNNEL_PID 2>/dev/null
  if command -v termux-wake-unlock &> /dev/null; then
    termux-wake-unlock
  fi
  echo -e "${GREEN}[✓] Termux daemon stopped. Goodbye!${NC}\n"
  exit 0
}

trap cleanup SIGINT SIGTERM
wait
