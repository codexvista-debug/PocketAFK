'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BotLifecycleState, ChatMessage, ContainerWindow, Telemetry, BotSettings } from '../types';

export type SocketStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTHENTICATED' | 'AUTH_ERROR';

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
  enabled: boolean = true
) {
  const [daemonUrl, setDaemonUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pocketafk_daemon_url');
      if (stored && (stored.includes('localhost') || stored.includes('127.0.0.1'))) {
        localStorage.removeItem('pocketafk_daemon_url');
        return '';
      }
      if (stored) return stored;
    }
    return '';
  });

  const [authToken, setAuthToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pocketafk_daemon_token') || '';
    }
    return '';
  });

  const [status, setStatus] = useState<SocketStatus>('DISCONNECTED');
  
  // Per-bot dictionaries to support multiple running server instances simultaneously
  const [botStates, setBotStates] = useState<Record<string, BotLifecycleState>>({});
  const [botStateReasons, setBotStateReasons] = useState<Record<string, string>>({});
  const [telemetries, setTelemetries] = useState<Record<string, Telemetry>>({});
  const [messagesByBot, setMessagesByBot] = useState<Record<string, ChatMessage[]>>({});
  const [containerWindows, setContainerWindows] = useState<Record<string, ContainerWindow | null>>({});
  const [msAuthData, setMsAuthData] = useState<MsAuthData | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onAccountVerifiedRef = useRef(onAccountVerified);
  onAccountVerifiedRef.current = onAccountVerified;

  const saveSettings = useCallback((url: string, token: string) => {
    const cleanUrl = url.trim();
    setDaemonUrl(cleanUrl);
    setAuthToken(token);
    if (typeof window !== 'undefined') {
      if (cleanUrl) {
        localStorage.setItem('pocketafk_daemon_url', cleanUrl);
      } else {
        localStorage.removeItem('pocketafk_daemon_url');
      }
      localStorage.setItem('pocketafk_daemon_token', token);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
      setStatus('DISCONNECTED');
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
      return;
    }

    setStatus('CONNECTING');
    try {
      const ws = new WebSocket(daemonUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('CONNECTED');
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        ws.send(JSON.stringify({
          type: 'AUTH',
          payload: { token: authToken }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'AUTH_RESULT':
              if (data.payload.success) {
                setStatus('AUTHENTICATED');
              } else {
                setStatus('AUTH_ERROR');
              }
              break;

            case 'BOT_STATE': {
              const { botId, state, reason, connectedAt, uptime } = data.payload;
              if (botId) {
                setBotStates((prev) => ({ ...prev, [botId]: state }));
                if (reason !== undefined) {
                  setBotStateReasons((prev) => ({ ...prev, [botId]: reason }));
                }
                if (uptime !== undefined || connectedAt !== undefined) {
                  setTelemetries((prev) => ({
                    ...prev,
                    [botId]: {
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
                      connectedAt: connectedAt ?? prev[botId]?.connectedAt,
                      uptime: uptime ?? prev[botId]?.uptime,
                    },
                  }));
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
        socketRef.current = null;
        if (enabled && daemonUrl && !daemonUrl.includes('localhost')) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2500);
        }
      };

      ws.onerror = () => {
        setStatus('DISCONNECTED');
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (e) {
      setStatus('DISCONNECTED');
    }
  }, [daemonUrl, authToken, enabled]);

  useEffect(() => {
    if (enabled && daemonUrl && !daemonUrl.includes('localhost')) {
      connect();
    } else if (!enabled && socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
      setStatus('DISCONNECTED');
    }
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, daemonUrl, enabled]);

  const sendJson = useCallback((msg: any) => {
    if (!enabled) return false;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, [enabled]);

  const startBot = useCallback((config: any) => {
    return sendJson({ type: 'START_BOT', payload: config });
  }, [sendJson]);

  const stopBot = useCallback((botId: string) => {
    setBotStates((prev) => ({ ...prev, [botId]: 'DISCONNECTED' }));
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

  const clearMessages = useCallback((botId?: string) => {
    if (botId) {
      setMessagesByBot((prev) => ({ ...prev, [botId]: [] }));
    } else {
      setMessagesByBot({});
    }
  }, []);

  // Scoped getters for active instance
  const currentBotId = activeBotId || '';
  const currentBotState: BotLifecycleState = (currentBotId && botStates[currentBotId]) || 'DISCONNECTED';
  const currentBotReason: string = (currentBotId && botStateReasons[currentBotId]) || '';
  const currentTelemetry: Telemetry | null = (currentBotId && telemetries[currentBotId]) || null;
  const currentMessages: ChatMessage[] = (currentBotId && messagesByBot[currentBotId]) || [];
  const currentWindow: ContainerWindow | null = (currentBotId && containerWindows[currentBotId]) || null;

  return {
    status: enabled ? status : 'DISCONNECTED',
    botState: currentBotState,
    botStateReason: currentBotReason,
    telemetry: currentTelemetry,
    messages: currentMessages,
    containerWindow: currentWindow,
    botStates,
    botStateReasons,
    telemetries,
    messagesByBot,
    daemonUrl,
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
    clearMessages,
    msAuthData,
    clearMsAuth: () => setMsAuthData(null),
  };
}
