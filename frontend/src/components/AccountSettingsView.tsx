'use client';

import React, { useMemo, useState } from 'react';
import { Activity, AlertCircle, Check, CheckCircle2, Clock3, Copy, KeyRound, Link2, LockKeyhole, Radio, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { DaemonConnectionSnapshot, SocketStatus } from '../lib/useDaemonSocket';

interface AccountSettingsViewProps {
  username: string;
  socketStatus: SocketStatus;
  daemonUrl: string;
  daemonConnections: DaemonConnectionSnapshot | null;
  onPasswordChanged: (secretCode: string) => void;
}

function safeEndpoint(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return value ? 'Configured WebSocket endpoint' : 'No daemon endpoint configured';
  }
}

function statusLabel(status: SocketStatus) {
  if (status === 'AUTHENTICATED') return 'Connected and authenticated';
  if (status === 'CONNECTED') return 'Socket open · checking access';
  if (status === 'CONNECTING') return 'Connecting to daemon';
  if (status === 'AUTH_ERROR') return 'Authentication rejected';
  return 'Disconnected';
}

export function AccountSettingsView({ username, socketStatus, daemonUrl, daemonConnections, onPasswordChanged }: AccountSettingsViewProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [updatedInstallerCommand, setUpdatedInstallerCommand] = useState('');
  const [commandCopied, setCommandCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const connected = socketStatus === 'AUTHENTICATED';
  const endpoint = useMemo(() => safeEndpoint(daemonUrl), [daemonUrl]);

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'The new passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Choose a new password with at least 8 characters.' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', username, currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Could not update your password.');
      if (typeof data.secretCode === 'string') {
        onPasswordChanged(data.secretCode);
        setUpdatedInstallerCommand(`curl -sL https://pocketafk.vercel.app/install | bash -s -- ${username} ${data.secretCode}`);
        setCommandCopied(false);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password updated. Your daemon access key has been refreshed.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Could not update your password.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pa-account-page">
      <header className="pa-account-heading">
        <div className="pa-account-kicker"><span className="pa-account-kicker-icon"><KeyRound size={15}/></span> PLAYER PROFILE</div>
        <h1>Your account</h1>
        <p>Manage your PocketAFK sign-in and see the browser connections linked to your Termux daemon.</p>
      </header>

      <div className="pa-account-grid">
        <section className="pa-account-panel">
          <div className="pa-account-panel-head">
            <span className="pa-account-panel-icon"><LockKeyhole size={17}/></span>
            <div><h2>Change password</h2><p>Update the password for @{username}.</p></div>
          </div>
          <form onSubmit={handlePasswordChange} className="pa-account-form">
            <label>Current password<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter your current password"/></label>
            <label>New password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters"/><small>Use at least 8 characters.</small></label>
            <label>Confirm new password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type the new password again"/></label>
            {message && <div className={`pa-account-message ${message.type === 'success' ? 'is-success' : 'is-error'}`}>{message.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}<span>{message.text}</span></div>}
            {updatedInstallerCommand && <div className="pa-account-refresh-command"><p>Run this once in Termux to refresh the daemon’s tunnel key.</p><button type="button" onClick={async () => { await navigator.clipboard.writeText(updatedInstallerCommand); setCommandCopied(true); }}><code>curl …/install | bash -s -- {username} ••••••••••</code>{commandCopied ? <Check size={15}/> : <Copy size={15}/>}<span>{commandCopied ? 'Copied' : 'Copy updated command'}</span></button></div>}
            <button type="submit" disabled={isSaving || !currentPassword || !newPassword || !confirmPassword} className="pa-account-submit">{isSaving ? 'Updating password…' : <><ShieldCheck size={16}/> Update password</>}</button>
            <p className="pa-account-privacy">Your password is verified on the server and stored as a hash. It is never displayed after saving.</p>
          </form>
        </section>

        <section className="pa-account-panel">
          <div className="pa-account-panel-head">
            <span className={`pa-account-panel-icon ${connected ? 'is-online' : ''}`}><Radio size={17}/></span>
            <div><h2>Daemon WebSockets</h2><p>Authenticated browser connections to your Termux daemon.</p></div>
          </div>
          <div className="pa-ws-summary">
            <div className="pa-ws-status"><span className={`pa-ws-status-light ${connected ? 'is-online' : socketStatus === 'CONNECTING' || socketStatus === 'CONNECTED' ? 'is-pending' : 'is-offline'}`}/><span>{statusLabel(socketStatus)}</span></div>
            <div className="pa-ws-count"><b>{connected && daemonConnections ? daemonConnections.connections.length : connected ? '—' : '0'}</b><span>browser {connected && daemonConnections?.connections.length === 1 ? 'socket' : 'sockets'}</span></div>
          </div>
          <div className="pa-ws-endpoint"><Link2 size={15}/><div><span>Daemon endpoint</span><b>{endpoint}</b></div></div>
          {connected && daemonConnections ? (
            <div className="pa-ws-list">
              <div className="pa-ws-list-title"><span>Connected browser sessions</span><span>{daemonConnections.connections.length}</span></div>
              {daemonConnections.connections.length ? daemonConnections.connections.map((connection, index) => {
                const isCurrent = connection.id === daemonConnections.currentConnectionId;
                return <div key={connection.id} className="pa-ws-row"><span className={`pa-ws-session-icon ${isCurrent ? 'is-current' : ''}`}><Wifi size={14}/></span><div className="pa-ws-session-copy"><b>{isCurrent ? 'This dashboard' : `Browser session ${index + 1}`}</b><small><Clock3 size={12}/> Connected {new Date(connection.connectedAt).toLocaleString()}</small></div><span className="pa-ws-session-id">{connection.id.slice(0, 8)}</span></div>;
              }) : <div className="pa-ws-empty">No browser sessions are currently attached.</div>}
            </div>
          ) : connected ? (
            <div className="pa-ws-compat"><Activity size={16}/><span>Your daemon is connected. Restart it once from the latest PocketAFK installer to show all connected browser sessions here.</span></div>
          ) : (
            <div className="pa-ws-offline"><WifiOff size={17}/><span>Start the daemon from Termux to see live WebSocket sessions here.</span></div>
          )}
          <p className="pa-ws-security">Connection identifiers are temporary. IP addresses and daemon tokens are not shown.</p>
        </section>
      </div>
    </div>
  );
}
