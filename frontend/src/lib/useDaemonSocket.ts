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

export function useDaemonSocket(initialUrl?: string, initialToken?: string) {
  const [daemonUrl, setDaemonUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pocketafk_daemon_url');
      if (stored && (stored.includes('localhost') || stored.includes('127.0.0.1'))) {
        localStorage.removeItem('pocketafk_daemon_url');
        return '';
      }
      if (stored) return stored;
    }
    if (initialUrl && !initialUrl.includes('localhost') && !initialUrl.includes('127.0.0.1')) {
      return initialUrl;
    }
    return '';
  });

  const [authToken, setAuthToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pocketafk_daemon_token') || initialToken || '';
    }
    return initialToken || '';
  });

  const [status, setStatus] = useState<SocketStatus>('DISCONNECTED');
  const [botState, setBotState] = useState<BotLifecycleState>('DISCONNECTED');
  const [botStateReason, setBotStateReason] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [containerWindow, setContainerWindow] = useState<ContainerWindow | null>(null);
  const [msAuthData, setMsAuthData] = useState<MsAuthData | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveSettings = useCallback((url: string, token: string) => {
    // If user tries to set localhost, prevent it on https production
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
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        // ignore
      }
    }

    // Never connect if empty, or if localhost
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

            case 'BOT_STATE':
              setBotState(data.payload.state);
              setBotStateReason(data.payload.reason || '');
              break;

            case 'CHAT_MESSAGE':
              setMessages((prev) => [...prev.slice(-250), data.payload]);
              break;

            case 'TELEMETRY':
              setTelemetry(data.payload);
              break;

            case 'CONTAINER_WINDOW':
              setContainerWindow(data.payload);
              break;

            case 'WINDOW_CLOSE':
              setContainerWindow(null);
              break;

            case 'MS_AUTH_CODE':
              setMsAuthData(data.payload);
              break;
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setStatus('DISCONNECTED');
        socketRef.current = null;
      };

      ws.onerror = () => {
        setStatus('DISCONNECTED');
      };
    } catch (e) {
      setStatus('DISCONNECTED');
    }
  }, [daemonUrl, authToken]);

  useEffect(() => {
    if (daemonUrl && !daemonUrl.includes('localhost')) {
      connect();
    }
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, daemonUrl]);

  const sendJson = useCallback((msg: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const startBot = useCallback((config: any) => {
    return sendJson({ type: 'START_BOT', payload: config });
  }, [sendJson]);

  const stopBot = useCallback((botId: string) => {
    return sendJson({ type: 'STOP_BOT', payload: { botId } });
  }, [sendJson]);

  const restartBot = useCallback((botId: string) => {
    return sendJson({ type: 'RESTART_BOT', payload: { botId } });
  }, [sendJson]);

  const sendChat = useCallback((botId: string, message: string) => {
    return sendJson({ type: 'SEND_CHAT', payload: { botId, message } });
  }, [sendJson]);

  const clickSlot = useCallback((botId: string, windowId: number, slot: number, mouseButton = 0, mode = 0) => {
    return sendJson({ type: 'CLICK_SLOT', payload: { botId, windowId, slot, mouseButton, mode } });
  }, [sendJson]);

  const closeWindow = useCallback((botId: string, windowId: number) => {
    setContainerWindow(null);
    return sendJson({ type: 'CLOSE_WINDOW', payload: { botId, windowId } });
  }, [sendJson]);

  const updateSettings = useCallback((botId: string, settings: Partial<BotSettings>) => {
    return sendJson({ type: 'UPDATE_SETTINGS', payload: { botId, settings } });
  }, [sendJson]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    status,
    botState,
    botStateReason,
    messages,
    telemetry,
    containerWindow,
    daemonUrl,
    authToken,
    saveSettings,
    reconnect: connect,
    startBot,
    stopBot,
    restartBot,
    sendChat,
    clickSlot,
    closeWindow,
    updateSettings,
    clearMessages,
    msAuthData,
    clearMsAuth: () => setMsAuthData(null),
  };
}
