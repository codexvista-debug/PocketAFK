import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Terminal,
  Bot,
  Radio,
  ExternalLink,
  Copy,
  Info,
  Gift,
  Clock,
  ShieldCheck,
  Zap,
  Activity,
  Heart,
  MessageSquare,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { WebhookConfig } from '@/types';

interface WebhookViewProps {
  currentUser: string;
  config: WebhookConfig;
  onUpdateConfig: (nextConfig: WebhookConfig) => void;
  onSaveConfig: () => Promise<void>;
  isDaemonConnected: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function WebhookView({
  currentUser,
  config,
  onUpdateConfig,
  onSaveConfig,
  isDaemonConnected,
  showToast,
}: WebhookViewProps) {
  const [testingDaemon, setTestingDaemon] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState<'joined' | 'reward' | 'disconnect' | 'daemon'>('joined');

  const updateField = <K extends keyof WebhookConfig>(key: K, value: WebhookConfig[K]) => {
    onUpdateConfig({
      ...config,
      [key]: value,
    });
  };

  const handleTestWebhook = async (type: 'daemon' | 'bot') => {
    const targetUrl = type === 'daemon' ? config.daemonWebhookUrl : config.botWebhookUrl;
    if (!targetUrl || !targetUrl.trim()) {
      showToast(`Please enter a valid Discord webhook URL for ${type === 'daemon' ? 'Daemon' : 'Bot'} alerts first.`, 'error');
      return;
    }

    if (type === 'daemon') setTestingDaemon(true);
    else setTestingBot(true);

    try {
      const res = await fetch('/api/webhook-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl.trim(),
          type,
          username: currentUser,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Discord test alert delivered successfully! Check your Discord channel.`, 'success');
      } else {
        showToast(data.error || 'Failed to send Discord test message.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error sending Discord webhook test.', 'error');
    } finally {
      if (type === 'daemon') setTestingDaemon(false);
      else setTestingBot(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveConfig();
      showToast('Discord webhook preferences saved & synced!', 'success');
    } catch (e) {
      showToast('Failed to save webhook preferences.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isDaemonConfigured = Boolean(config.daemonWebhookUrl.trim());
  const isBotConfigured = Boolean(config.botWebhookUrl.trim());

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-md border border-indigo-800/40">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] font-black uppercase tracking-wider">
            <Bell className="w-3.5 h-3.5 text-indigo-400" />
            <span>Discord Notifications</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Discord Webhooks
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Get instant, real-time alerts sent straight to your Discord channels. Keep track of your background daemon bridge status and receive unified activity updates for all your Minecraft bots in one place.
          </p>
        </div>

        {/* Quick Status Bar */}
        <div className="mt-6 pt-5 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="font-bold text-slate-200">Daemon Webhook</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {isDaemonConfigured ? 'Configured & Active' : 'Not configured yet'}
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isDaemonConfigured
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-700/60 text-slate-400 border-slate-600/60'
              }`}
            >
              {isDaemonConfigured ? 'Active' : 'Standby'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-2.5">
              <Bot className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="font-bold text-slate-200">All Bots Webhook</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {isBotConfigured ? '1 Webhook For All Bots' : 'Not configured yet'}
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isBotConfigured
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-700/60 text-slate-400 border-slate-600/60'
              }`}
            >
              {isBotConfigured ? 'Active' : 'Standby'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: DAEMON WEBHOOK */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-slate-900 text-base">Daemon Webhook</h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      System
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Dedicated alerts for your phone or VPS daemon bridge.
                  </p>
                </div>
              </div>

              {/* Master Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={config.daemonEnabled}
                  onChange={(e) => updateField('daemonEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* URL Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Discord Webhook URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={config.daemonWebhookUrl}
                  onChange={(e) => updateField('daemonWebhookUrl', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Create a webhook in your Discord channel: <em>Channel Settings → Integrations → Webhooks → New Webhook</em>.
              </p>
            </div>

            {/* Event Toggles */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-slate-700">
                Daemon Event Notifications
              </label>

              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.daemonNotifyOnline}
                    onChange={(e) => updateField('daemonNotifyOnline', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Daemon Online & Bridge Connected
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Notifies immediately when your daemon starts running or reconnects.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.daemonNotifyOffline}
                    onChange={(e) => updateField('daemonNotifyOffline', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Daemon Disconnected / Offline
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Alerts if the daemon bridge goes offline or your phone kills the background task.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.daemonNotifyErrors}
                    onChange={(e) => updateField('daemonNotifyErrors', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Daemon Errors & Restarts
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Reports uncaught server proxy drops, supervisor restarts, and anomalies.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.daemonNotifyHeartbeat}
                    onChange={(e) => updateField('daemonNotifyHeartbeat', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Hourly System Heartbeat
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Sends an hourly status summary confirming the daemon bridge is healthy.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Test Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleTestWebhook('daemon')}
              disabled={testingDaemon || !config.daemonWebhookUrl}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition disabled:opacity-40 cursor-pointer shadow-2xs"
            >
              {testingDaemon ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Delivering Test Alert...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Daemon Alert</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* CARD 2: GLOBAL BOT ACTIVITY WEBHOOK */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-slate-900 text-base">Minecraft Bot Webhook</h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800">
                      All Bots (Unified)
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    One single webhook channel for all your accounts & servers.
                  </p>
                </div>
              </div>

              {/* Master Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={config.botEnabled}
                  onChange={(e) => updateField('botEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* URL Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Discord Webhook URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={config.botWebhookUrl}
                  onChange={(e) => updateField('botWebhookUrl', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                All accounts route their join, disconnect, and AFK rewards here automatically.
              </p>
            </div>

            {/* Event Toggles */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-slate-700">
                Bot Activity Alerts (Applied to All Bots)
              </label>

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.botNotifyJoined}
                    onChange={(e) => updateField('botNotifyJoined', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Bot Joined & Spawned in Server
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Alerts when any Minecraft account connects and spawns into a server.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.botNotifyDisconnected}
                    onChange={(e) => updateField('botNotifyDisconnected', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      Bot Disconnected / Kicked
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Alerts with the exact kick/disconnect reason (e.g. AFK timeout, proxy kick).
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.botNotifyAfkReward}
                    onChange={(e) => updateField('botNotifyAfkReward', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-amber-500" />
                      AFK Reward Available / Spin Ready
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Alerts when chat detects an AFK reward notification or `/afkrewards` spin is ready.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.botNotifyUptime}
                    onChange={(e) => updateField('botNotifyUptime', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-sky-500" />
                      Periodic Bot Uptime Digest
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Summary report of active accounts, servers, coordinates, and health.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.botNotifyChatMentions}
                    onChange={(e) => updateField('botNotifyChatMentions', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                      Direct Whispers & Mentions
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Alerts when another player mentions your account username or sends a `/msg`.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.botNotifyLowHealth}
                    onChange={(e) => updateField('botNotifyLowHealth', e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      Low Health / Respawn Warning
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Alerts if bot health falls below 5 hearts or the bot takes mob damage.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Test Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleTestWebhook('bot')}
              disabled={testingBot || !config.botWebhookUrl}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-bold transition disabled:opacity-40 cursor-pointer shadow-2xs"
            >
              {testingBot ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Delivering Test Alert...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Bot Alert</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: LIVE DISCORD EMBED PREVIEW */}
      <div className="bg-[#2b2d31] rounded-3xl p-5 sm:p-6 text-slate-100 shadow-md border border-slate-700/50">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#5865F2] flex items-center justify-center text-white font-bold text-xs shadow-xs">
              💬
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Live Discord Message Preview</h3>
              <p className="text-[11px] text-slate-400">
                This is exactly how your alerts will appear inside your Discord channel.
              </p>
            </div>
          </div>

          {/* Preview Tab Selector */}
          <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setPreviewTab('joined')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                previewTab === 'joined' ? 'bg-[#5865F2] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bot Joined
            </button>
            <button
              onClick={() => setPreviewTab('reward')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                previewTab === 'reward' ? 'bg-[#5865F2] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AFK Reward
            </button>
            <button
              onClick={() => setPreviewTab('disconnect')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                previewTab === 'disconnect' ? 'bg-[#5865F2] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kicked / Left
            </button>
            <button
              onClick={() => setPreviewTab('daemon')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                previewTab === 'daemon' ? 'bg-[#5865F2] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daemon Status
            </button>
          </div>
        </div>

        {/* Discord Chat Bubble Mock */}
        <div className="bg-[#313338] rounded-2xl p-4 sm:p-5 border border-slate-700/40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
              ⛏
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm hover:underline cursor-pointer">
                  {previewTab === 'daemon' ? 'PocketAFK Daemon' : 'PocketAFK Bot Activity'}
                </span>
                <span className="bg-[#5865F2] text-white text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                  BOT
                </span>
                <span className="text-[11px] text-slate-400">Today at 12:45 PM</span>
              </div>

              {/* Embed Box */}
              {previewTab === 'joined' && (
                <div className="border-l-4 border-emerald-500 bg-[#2b2d31] rounded-r-xl p-3.5 space-y-2 max-w-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">🟢 Bot Spawned & Online</span>
                    <img
                      src="https://crafthead.net/helm/Gambit25X51916/32"
                      alt="Skin"
                      className="w-7 h-7 rounded-md border border-slate-600"
                    />
                  </div>
                  <p className="text-slate-300 text-xs">
                    Account **Gambit25X51916** successfully joined and spawned into **FreshSMP** (`mc.freshsmp.fun`).
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Account</div>
                      <div className="text-white font-mono text-[11px]">Gambit25X51916</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Server</div>
                      <div className="text-white font-mono text-[11px]">FreshSMP</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Coordinates</div>
                      <div className="text-emerald-400 font-mono text-[11px]">X: 142 Y: 68 Z: -201</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-700/60 font-mono">
                    PocketAFK Bedrock & Java Core • Auto-Reconnect Enabled
                  </div>
                </div>
              )}

              {previewTab === 'reward' && (
                <div className="border-l-4 border-amber-500 bg-[#2b2d31] rounded-r-xl p-3.5 space-y-2 max-w-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">🎁 AFK Reward Available!</span>
                    <span className="text-xl">🎰</span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    **SmoothBard81224** received an AFK reward notification on **FreshSMP**!
                  </p>
                  <div className="p-2 rounded-lg bg-[#1e1f22] font-mono text-xs text-amber-300 border border-amber-500/30">
                    &ldquo;[AFK] You have 1 AFK Reward Spin available! Type /afkrewards spin to claim.&rdquo;
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Account</div>
                      <div className="text-white font-mono text-[11px]">SmoothBard81224</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Action Recommended</div>
                      <div className="text-amber-400 font-bold text-[11px]">Open Terminal & Spin</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-700/60 font-mono">
                    PocketAFK AFK Detector • Instant Chat Trigger
                  </div>
                </div>
              )}

              {previewTab === 'disconnect' && (
                <div className="border-l-4 border-rose-500 bg-[#2b2d31] rounded-r-xl p-3.5 space-y-2 max-w-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">🔴 Bot Disconnected</span>
                    <span className="text-xl">⚠️</span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    **kjchris7** was disconnected from **DonutSMP** (`donutsmp.net`).
                  </p>
                  <div className="p-2 rounded-lg bg-[#1e1f22] font-mono text-xs text-rose-300 border border-rose-500/30">
                    Reason: Kicked by server &ldquo;AFK Limit Reached (30m)&rdquo;
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Account</div>
                      <div className="text-white font-mono text-[11px]">kjchris7</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Auto-Reconnect</div>
                      <div className="text-emerald-400 font-bold text-[11px]">Reconnecting in 5s...</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-700/60 font-mono">
                    PocketAFK Bedrock & Java Core • State Monitor
                  </div>
                </div>
              )}

              {previewTab === 'daemon' && (
                <div className="border-l-4 border-emerald-400 bg-[#2b2d31] rounded-r-xl p-3.5 space-y-2 max-w-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">⚡ Daemon Online</span>
                    <span className="text-xl">📱</span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    PocketAFK Daemon Bridge is running and authenticated for **@{currentUser || 'Opera'}**.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Host</div>
                      <div className="text-white font-mono text-[11px]">Termux / Linux</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Tunnel Port</div>
                      <div className="text-white font-mono text-[11px]">8080</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Status</div>
                      <div className="text-emerald-400 font-bold text-[11px]">Bridge Ready</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-700/60 font-mono">
                    PocketAFK Daemon Bridge • Termux Dedicated
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition cursor-pointer shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & Sync Webhooks</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
