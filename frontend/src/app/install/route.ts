import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const script = `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
#            PocketAFK - 1-Click Universal Termux Installer
# ==============================================================================
set -e

# Clear and show setup banner
clear
echo -e "\\033[1;36m"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║        🚀 PocketAFK 1-Click Termux Setup          ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "\\033[0m"

# 1. Dependency checks
echo -e "\\033[1;34m[1/3]\\033[0m 📦 Checking environment & dependencies..."
NEEDED_PKGS=()
for pkg in git nodejs-lts cloudflared; do
  if ! command -v $pkg >/dev/null 2>&1; then
    NEEDED_PKGS+=($pkg)
  fi
done

if [ \${#NEEDED_PKGS[@]} -gt 0 ]; then
  echo -e "      Installing required packages: \\033[1;33m\${NEEDED_PKGS[*]}\\033[0m..."
  pkg update -y >/dev/null 2>&1 || true
  pkg install -y "\${NEEDED_PKGS[@]}" >/dev/null 2>&1
  echo -e "      \\033[1;32m✓ Dependencies installed successfully.\\033[0m"
else
  echo -e "      \\033[1;32m✓ All dependencies ready.\\033[0m"
fi

# 2. Clone or update repository
echo -e "\\n\\033[1;34m[2/3]\\033[0m 📥 Syncing PocketAFK engine..."
cd "$HOME"
if [ -d "PocketAFK/.git" ]; then
  cd PocketAFK
  git reset --hard HEAD >/dev/null 2>&1
  git pull --force >/dev/null 2>&1 || true
  echo -e "      \\033[1;32m✓ Updated to latest version.\\033[0m"
else
  rm -rf PocketAFK 2>/dev/null || true
  git clone https://github.com/codexvista-debug/PocketAFK.git >/dev/null 2>&1
  cd PocketAFK
  echo -e "      \\033[1;32m✓ Cloned successfully.\\033[0m"
fi

# 3. Install packages if needed
cd daemon
if [ ! -d "node_modules" ]; then
  echo -e "\\n\\033[1;34m[3/3]\\033[0m ⚙️  Installing Node modules..."
  npm install --silent >/dev/null 2>&1
  echo -e "      \\033[1;32m✓ Modules configured.\\033[0m"
else
  echo -e "\\n\\033[1;34m[3/3]\\033[0m ⚙️  Modules verified."
fi

# 4. Launch daemon & tunnel
chmod +x start.sh 2>/dev/null || true
bash start.sh "$1" "$2"
`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
