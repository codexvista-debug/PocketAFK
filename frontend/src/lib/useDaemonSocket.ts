'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BotLifecycleState, ChatMessage, ContainerWindow, Telemetry, BotSettings, ActivityLog } from '../types';

export type SocketStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTHENTICATED' | 'AUTH_ERROR';

export interface DaemonConnectionSnapshot {
  connections: Array<{ id: string; connectedAt: number }>;
  currentConnectionId: string;
}

export interface MsAuthData {
  botId: string;
  userCode: string;
  url: string;
  message: string;
}

export interface AccountVerifiedData {
  botId: string;
  email: string;
  ign: string;
  uuid?: string;
}

export function useDaemonSocket(
  activeBotId?: string | null,
  onAccountVerified?: (data: AccountVerifiedData) => void,
  enabled: boolean = true,
  currentUser?: string | null
) {
  const [daemonUrl, setDaemonUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const u = currentUser ? currentUser.trim().toLowerCase() : 'guest';
      const stored = localStorage.getItem(`pocketafk_daemon_url_${u}`);
      if (stored && (stored.includes('localhost') || stored.includes('127.0.0.1'))) {
        localStorage.removeItem(`pocketafk_daemon_url_${u}`);
        return '';
      }
      if (stored) return stored;
    }
    return '';
  });

  const [authToken, setAuthToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const u = currentUser ? currentUser.trim().toLowerCase() : 'guest';
      return localStorage.getItem(`pocketafk_daemon_token_${u}`) || localStorage.getItem(`pocketafk_secret_${u}`) || '';
    }
    return '';
  });

  const [status, setStatus] = useState<SocketStatus>('DISCONNECTED');
  const [daemonConnections, setDaemonConnections] = useState<DaemonConnectionSnapshot | null>(null);
  
  // Per-bot dictionaries to support multiple running server instances simultaneously
  const [botStates, setBotStates] = useState<Record<string, BotLifecycleState>>({});
  const [botStateReasons, setBotStateReasons] = useState<Record<string, string>>({});
  const [botVersions, setBotVersions] = useState<Record<string, string>>({});
  const [telemetries, setTelemetries] = useState<Record<string, Telemetry>>({});
  const [messagesByBot, setMessagesByBot] = useState<Record<string, ChatMessage[]>>({});
  const [activityLogs, setActivityLogs] = useState<Record<string, ActivityLog[]>>({});
  const [containerWindows, setContainerWindows] = useState<Record<string, ContainerWindow | null>>({});
  const [msAuthData, setMsAuthData] = useState<MsAuthData | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onAccountVerifiedRef = useRef(onAccountVerified);
  onAccountVerifiedRef.current = onAccountVerified;

  // Seamless user switching: close old socket and reload credentials when switching account
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = currentUser ? currentUser.trim().toLowerCase() : 'guest';
    
    // Close existing socket connection immediately
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    const nextUrl = localStorage.getItem(`pocketafk_daemon_url_${u}`) || '';
    const nextToken = localStorage.getItem(`pocketafk_daemon_token_${u}`) || localStorage.getItem(`pocketafk_secret_${u}`) || '';
    
    setDaemonUrl(nextUrl);
    setAuthToken(nextToken);
    setStatus('DISCONNECTED');
    setDaemonConnections(null);
    setBotStates({});
    setBotStateReasons({});
    setBotVersions({});
    setTelemetries({});
    setMessagesByBot({});
    setContainerWindows({});
    setMsAuthData(null);

    // Clean up any legacy shared global keys
    localStorage.removeItem('pocketafk_daemon_url');
    localStorage.removeItem('pocketafk_daemon_token');
  }, [currentUser]);

  const saveSettings = useCallback((url: string, token: string) => {
    const cleanUrl = url.trim();
    setDaemonUrl(cleanUrl);
    setAuthToken(token);
    if (typeof window !== 'undefined') {
      const u = currentUser ? currentUser.trim().toLowerCase() : 'guest';
      if (cleanUrl) {
        localStorage.setItem(`pocketafk_daemon_url_${u}`, cleanUrl);
      } else {
        localStorage.removeItem(`pocketafk_daemon_url_${u}`);
      }
      localStorage.setItem(`pocketafk_daemon_token_${u}`, token);

      // Clean up legacy global keys
      localStorage.removeItem('pocketafk_daemon_url');
      localStorage.removeItem('pocketafk_daemon_token');
    }
  }, [currentUser]);

  const connect = useCallback(() => {
    if (!enabled) {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
      setStatus('DISCONNECTED');
      setDaemonConnections(null);
      return;
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        // ignore
      }
    }

    if (!daemonUrl || daemonUrl.trim() === '' || daemonUrl.includes('localhost') || daemonUrl.includes('127.0.0.1')) {
      setStatus('DISCONNECTED');
      setDaemonConnections(null);
      return;
    }

    setStatus('CONNECTING');
    setDaemonConnections(null);
    try {
      const ws = new WebSocket(daemonUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('CONNECTED');
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        const effectiveToken = authToken || (typeof window !== 'undefined' ? localStorage.getItem(`pocketafk_secret_${currentUser ? currentUser.trim().toLowerCase() : 'guest'}`) || '' : '');
        ws.send(JSON.stringify({
          type: 'AUTH',
          payload: { 
            token: effectiveToken,
            username: currentUser || 'guest'
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'AUTH_RESULT':
              if (data.payload.success) {
                setStatus('AUTHENTICATED');
                // Start keepalive PING every 10s to prevent Cloudflare tunnel & mobile carrier NAT timeout
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = setInterval(() => {
                  if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    try {
                      socketRef.current.send(JSON.stringify({ type: 'PING' }));
                    } catch (e) {}
                  }
                }, 10000);
              } else {
                console.warn('[Daemon Auth Rejected]', data.payload?.message);
                setStatus('AUTH_ERROR');
                setDaemonConnections(null);
                if (socketRef.current) {
                  try {
                    socketRef.current.close();
                  } catch (e) {}
                  socketRef.current = null;
                }
              }
              break;

            case 'CONNECTION_STATUS':
              setDaemonConnections({
                connections: Array.isArray(data.payload?.connections) ? data.payload.connections : [],
                currentConnectionId: typeof data.payload?.currentConnectionId === 'string' ? data.payload.currentConnectionId : '',
              });
              break;

            case 'BOT_STATE': {
              const { botId, state, reason, connectedAt, uptime, username, version } = data.payload;
              if (botId) {
                setBotStates((prev) => ({ ...prev, [botId]: state }));
                if (reason !== undefined) {
                  setBotStateReasons((prev) => ({ ...prev, [botId]: reason }));
                }
                if (version) {
                  setBotVersions((prev) => ({ ...prev, [botId]: version }));
                }
                if (uptime !== undefined || connectedAt !== undefined || version !== undefined) {
                  setTelemetries((prev) => {
                    const updated: Telemetry = {
                      ...(prev[botId] || {
                        botId,
                        health: 20,
                        maxHealth: 20,
                        food: 20,
                        saturation: 5,
                        position: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
                        dimension: 'overworld',
                        gamemode: 'survival',
                        ping: 0,
                      }),
                      accountUsername: username ?? prev[botId]?.accountUsername,
                      connectedAt: connectedAt ?? prev[botId]?.connectedAt,
                      uptime: uptime ?? prev[botId]?.uptime,
                      version: version ?? prev[botId]?.version,
                    };
                    return { ...prev, [botId]: updated };
                  });
                }
                // Automatically dismiss Microsoft Auth modal once the bot connects or logs in!
                if (state === 'LOGGED_IN' || state === 'SPAWNED') {
                  setMsAuthData((prev) => (prev?.botId === botId || !prev?.botId ? null : prev));
                }
              }
              break;
            }

            case 'CHAT_MESSAGE': {
              const msg: ChatMessage = data.payload;
              const bId = msg.botId || 'default';
              setMessagesByBot((prev) => ({
                ...prev,
                [bId]: [...(prev[bId] || []).slice(-250), msg]
              }));
              break;
            }

            case 'TELEMETRY': {
              const t: Telemetry = data.payload;
              if (t.botId) {
                setTelemetries((prev) => ({ ...prev, [t.botId]: t }));
                if (t.version) {
                  setBotVersions((prev) => ({ ...prev, [t.botId]: t.version! }));
                }
              }
              break;
            }

            case 'CONTAINER_WINDOW': {
              const cw: ContainerWindow = data.payload;
              if (cw.botId) {
                setContainerWindows((prev) => ({ ...prev, [cw.botId]: cw }));
              }
              break;
            }

            case 'WINDOW_CLOSE': {
              const bId = data.payload?.botId;
              if (bId) {
                setContainerWindows((prev) => ({ ...prev, [bId]: null }));
              }
              break;
            }

            case 'ACTIVITY_LOG': {
              const log: ActivityLog = data.payload;
              if (log.botId) {
                setActivityLogs((prev) => {
                  const cur = prev[log.botId] || [];
                  const last = cur[cur.length - 1];
                  if (last && last.message === log.message && Math.abs(log.timestamp - last.timestamp) < 2000) {
                    return prev;
                  }
                  return {
                    ...prev,
                    [log.botId]: [...cur.slice(-200), log]
                  };
                });
              }
              break;
            }

            case 'MS_AUTH_CODE': {
              setMsAuthData(data.payload);
              break;
            }

            case 'ACCOUNT_VERIFIED': {
              setMsAuthData(null);
              if (onAccountVerifiedRef.current) {
                onAccountVerifiedRef.current(data.payload);
              }
              break;
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setStatus('DISCONNECTED');
        setDaemonConnections(null);
        socketRef.current = null;
        setBotStates({});
        setBotStateReasons({});
        setTelemetries({});
        setActivityLogs({});
        setContainerWindows({});
        setMsAuthData(null);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (enabled && daemonUrl && !daemonUrl.includes('localhost')) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2000);
        }
      };

      ws.onerror = () => {
        setStatus('DISCONNECTED');
        setDaemonConnections(null);
        setBotStates({});
        setBotStateReasons({});
        setTelemetries({});
        setContainerWindows({});
        setMsAuthData(null);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (e) {
      setStatus('DISCONNECTED');
      setDaemonConnections(null);
    }
  }, [daemonUrl, authToken, enabled, currentUser]);

  useEffect(() => {
    if (enabled && daemonUrl && !daemonUrl.includes('localhost')) {
      connect();
    } else {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
      setStatus('DISCONNECTED');
      setDaemonConnections(null);
    }
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, [connect, daemonUrl, enabled]);

  const sendJson = useCallback((msg: any) => {
    if (!enabled || !daemonUrl || status !== 'AUTHENTICATED') return false;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, [enabled, daemonUrl, status]);

  const startBot = useCallback((config: any) => {
    if (config?.id) {
      setBotStates((prev) => ({
        ...prev,
        [config.id]: 'CONNECTING' as BotLifecycleState,
      }));
    }
    return sendJson({ type: 'START_BOT', payload: config });
  }, [sendJson]);

  const stopBot = useCallback((botId: string, _accountId?: string, _username?: string) => {
    setBotStates((prev) => ({
      ...prev,
      [botId]: 'DISCONNECTED' as BotLifecycleState,
    }));
    return sendJson({ type: 'STOP_BOT', payload: { botId } });
  }, [sendJson]);

  const restartBot = useCallback((botId: string) => {
    return sendJson({ type: 'RESTART_BOT', payload: { botId } });
  }, [sendJson]);

  const restartDaemon = useCallback((reason = 'User requested restart from dashboard') => {
    setBotStates({});
    setBotStateReasons({});
    return sendJson({ type: 'RESTART_DAEMON', payload: { reason } });
  }, [sendJson]);

  const sendChat = useCallback((botId: string, message: string, targetAccount?: string) => {
    return sendJson({ type: 'SEND_CHAT', payload: { botId, message, targetAccount } });
  }, [sendJson]);

  const clickSlot = useCallback((botId: string, windowId: number, slot: number, mouseButton = 0, mode = 0) => {
    return sendJson({ type: 'CLICK_SLOT', payload: { botId, windowId, slot, mouseButton, mode } });
  }, [sendJson]);

  const closeWindow = useCallback((botId: string, windowId: number) => {
    setContainerWindows((prev) => ({ ...prev, [botId]: null }));
    return sendJson({ type: 'CLOSE_WINDOW', payload: { botId, windowId } });
  }, [sendJson]);

  const updateSettings = useCallback((botId: string, settings: Partial<BotSettings>) => {
    return sendJson({ type: 'UPDATE_SETTINGS', payload: { botId, settings } });
  }, [sendJson]);

  const verifyAccount = useCallback((accountId: string, email: string) => {
    return sendJson({ type: 'VERIFY_ACCOUNT', payload: { accountId, email } });
  }, [sendJson]);

  const importAccountTokens = useCallback((ign: string, tokenCache: any) => {
    if (!ign || !tokenCache) return false;
    return sendJson({ type: 'IMPORT_ACCOUNT_TOKENS', payload: { ign, tokenCache } });
  }, [sendJson]);

  const updateWebhookConfig = useCallback((config: any) => {
    return sendJson({ type: 'UPDATE_WEBHOOK_CONFIG', payload: config });
  }, [sendJson]);

  const clearMessages = useCallback((botId?: string) => {
    if (botId) {
      setMessagesByBot((prev) => {
        const next = { ...prev };
        delete next[botId];
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${botId}__`)) delete next[k];
        }
        return next;
      });
    } else {
      setMessagesByBot({});
    }
  }, []);

  // Scoped getters for active instance (supports multi-account sub-bots under activeServerId)
  const currentBotId = activeBotId || '';
  const isDaemonAuthenticated = enabled && status === 'AUTHENTICATED';
  const subBotStates = isDaemonAuthenticated ? Object.entries(botStates).filter(([k]) => k.startsWith(`${currentBotId}__`)) : [];
  const activeSubState = subBotStates.find(([, s]) => s === 'SPAWNED' || s === 'LOGGED_IN' || s === 'CONNECTING')?.[1];

  const currentBotState: BotLifecycleState = isDaemonAuthenticated
    ? ((currentBotId && botStates[currentBotId]) ||
       activeSubState ||
       'DISCONNECTED')
    : 'DISCONNECTED';

  const currentBotReason: string = isDaemonAuthenticated
    ? ((currentBotId && botStateReasons[currentBotId]) ||
       subBotStates.find(([k]) => botStateReasons[k])?.[1] ||
       '')
    : (status === 'CONNECTING' ? 'Connecting to Termux daemon...' : 'Termux daemon is offline');

  const currentTelemetry: Telemetry | null = isDaemonAuthenticated
    ? ((currentBotId && telemetries[currentBotId]) ||
       Object.entries(telemetries).find(([k, t]) => k.startsWith(`${currentBotId}__`) && t !== null)?.[1] ||
       null)
    : null;

  const currentMessages: ChatMessage[] = currentBotId
    ? Object.entries(messagesByBot)
        .filter(([bId]) => bId === currentBotId || bId.startsWith(`${currentBotId}__`))
        .flatMap(([, msgs]) => msgs)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-250)
    : [];

  const currentActivityLogs: ActivityLog[] = currentBotId
    ? Object.entries(activityLogs)
        .filter(([bId]) => bId === currentBotId || bId.startsWith(`${currentBotId}__`))
        .flatMap(([, logs]) => logs)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-150)
    : [];

  const currentWindow: ContainerWindow | null = isDaemonAuthenticated
    ? ((currentBotId && containerWindows[currentBotId]) ||
       Object.entries(containerWindows).find(([k, w]) => k.startsWith(`${currentBotId}__`) && w !== null)?.[1] ||
       null)
    : null;

  return {
    status: enabled ? status : 'DISCONNECTED',
    botState: currentBotState,
    botStateReason: currentBotReason,
    telemetry: currentTelemetry,
    messages: currentMessages,
    activityLogs,
    currentActivityLogs,
    containerWindow: currentWindow,
    botStates: isDaemonAuthenticated ? botStates : {},
    botStateReasons: isDaemonAuthenticated ? botStateReasons : {},
    botVersions: isDaemonAuthenticated ? botVersions : {},
    telemetries: isDaemonAuthenticated ? telemetries : {},
    messagesByBot,
    daemonUrl,
    daemonConnections,
    authToken,
    saveSettings,
    reconnect: connect,
    startBot,
    stopBot,
    restartBot,
    restartDaemon,
    sendChat,
    clickSlot,
    closeWindow,
    updateSettings,
    verifyAccount,
    importAccountTokens,
    updateWebhookConfig,
    clearMessages,
    msAuthData,
    clearMsAuth: () => setMsAuthData(null),
  };
}
