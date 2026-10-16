# 🎮 PocketAFK

**PocketAFK** is a lightweight, 24/7 Minecraft Java AFK bot management system designed to run entirely on an Android phone via **Termux** with a modern, responsive web dashboard deployed to **Vercel**.

---

## 🌟 Architecture & Why Pure Java

PocketAFK discards `bedrock-protocol` in favor of a pure Java stack powered by **Mineflayer**:
* **True Physics & Terrain Collision:** Client-side ticks, block collision, gravity, and ground states are computed properly.
* **Real Mob Farming (Fixed Swing-in-Air Bug):** Unlike simple bots that only trigger client arm animations (`swingArm()`), PocketAFK's mob farm targets the nearest entity's bounding box, aims the camera, respects 1.9+ weapon recovery cooldowns (650ms), and sends genuine `INTERACT_ENTITY` attack packets.
* **Auto-Accept Resource Packs:** Automatically accepts and acknowledges server resource packs so servers don't freeze or kick the bot in limbo.
* **Interactive Container Menus:** Mineflayer streams in-game chest and menu slots directly to your phone browser, allowing you to click server GUI menus from anywhere.
* **Zero Input Lag:** Fast TCP packet handling with minimal memory footprint (~100MB on Android).

---

## 📁 Repository Structure

```text
PocketAFK/
├── daemon/               # Node.js + Mineflayer bot daemon for Termux
│   ├── src/
│   │   ├── bot/          # PocketBotInstance & BotManager
│   │   ├── utils/        # Minecraft § color codes parser
│   │   ├── index.ts      # WebSocket server + Token Auth
│   │   └── types.ts      # Bi-directional WebSocket protocol
│   └── package.json
├── frontend/             # Next.js 14 App Router + TailwindCSS web UI
│   ├── src/
│   │   ├── app/          # Dashboard page & layouts
│   │   ├── components/   # Terminal, HUD, ContainerModal, Settings
│   │   └── lib/          # WebSocket hook & Supabase client
│   └── package.json
└── supabase/
    └── schema.sql        # Starter SQL schema for PostgreSQL & RLS
```

---

## 🚀 Step 1: Set Up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in the Supabase Dashboard.
3. Open `supabase/schema.sql` in this repo, copy its contents, and run it.
4. Go to **Project Settings -> API** and copy:
   * **Project URL**
   * **Anon / Public Key**

---

## ⚡ Step 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New... -> Project**.
2. Select your `PocketAFK` GitHub repository.
3. Under **Root Directory**, click **Edit** and choose `frontend`.
4. Under **Environment Variables**, add:
   * `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase Anon key
   * `NEXT_PUBLIC_DEFAULT_DAEMON_URL` = `wss://your-tunnel.trycloudflare.com` (or your custom domain)
5. Click **Deploy**.

---

## 📱 Step 3: Run the Daemon on Android (Termux)

1. Install **Termux** from [F-Droid](https://f-droid.org/packages/com.termux/) (do not use Google Play Store).
2. Open Termux and prevent Android from putting it to sleep:
   ```bash
   termux-wake-lock
   ```
3. Update packages and install Node.js, Git, and Cloudflared:
   ```bash
   pkg update -y && pkg install git nodejs-lts cloudflared -y
   ```
4. Clone the repository and enter the daemon folder:
   ```bash
   git clone https://github.com/codexvista-debug/PocketAFK.git
   cd PocketAFK/daemon
   npm install
   ```
5. Copy environment file and configure your port/password:
   ```bash
   cp .env.example .env
   ```
6. Start the daemon:
   ```bash
   npm run start
   ```
7. In a new Termux session (swipe from left and click "New Session"), expose the port via Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
8. Copy the generated `https://...` or `wss://...` URL and paste it into your Vercel Dashboard Settings!
