'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Lock, UserPlus, LogIn, ShieldAlert, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (username: string, secretCode?: string, isNewUser?: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationsPaused, setRegistrationsPaused] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/auth?check_registrations=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.registrationsPaused !== undefined) {
          setRegistrationsPaused(Boolean(data.registrationsPaused));
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUsernameChange = (val: string) => {
    // Only allow alphanumeric, max 6 characters
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    setUsername(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Username is required (max 6 letters/numbers)');
      return;
    }

    if (!/^[a-zA-Z0-9]{1,6}$/.test(cleanUser)) {
      setError('Username must be 1 to 6 letters or numbers only (no symbols)');
      return;
    }

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isRegister ? 'register' : 'login',
          username: cleanUser,
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Authentication failed');
        return;
      }

      onSuccess(data.user.username, data.user.secretCode, Boolean(data.user?.isNewUser || isRegister));
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pa-auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="pa-auth-modal" role="dialog" aria-modal="true" aria-labelledby="pa-auth-title">
        <header className="pa-auth-header">
          <div className="pa-auth-brand"><img src="/pocketafk-emblem.png" alt=""/><div><h2 id="pa-auth-title">{isRegister ? 'Your next world awaits' : 'Welcome back, builder'}</h2><span>JAVA CONTROL DECK <i/> SECURE SIGN IN</span></div></div>
          <button type="button" className="pa-auth-close" onClick={onClose} aria-label="Close sign in"><X size={20}/></button>
        </header>
        <div className="pa-auth-body">
          <form onSubmit={handleSubmit} className="pa-auth-form">
            <div className="pa-auth-kicker">{isRegister ? 'START YOUR JOURNEY' : 'GOOD TO SEE YOU'}</div>
            <h3>{isRegister ? 'Create your account.' : 'Pick up where your world left off.'}</h3>
            <p className="pa-auth-subtitle">{isRegister ? 'One small control room for every Java world.' : 'Your Java worlds and crew are right where you left them.'}</p>
            {error && <div className="pa-auth-alert"><ShieldAlert size={16}/><span>{error}</span></div>}
            {isRegister && registrationsPaused && <div className="pa-auth-alert pa-auth-notice"><ShieldAlert size={16}/><span>Public registrations are temporarily paused by the administrator.</span></div>}
            <div className="pa-auth-field"><div className="pa-auth-label"><label htmlFor="pa-username">Username</label><span>{username.length}/6</span></div><div className="pa-auth-input"><User size={16}/><input id="pa-username" type="text" required maxLength={6} value={username} onChange={(e) => handleUsernameChange(e.target.value)} placeholder="e.g. Chief" autoComplete="username"/></div><small>Letters and numbers only · up to 6 characters</small></div>
            <div className="pa-auth-field"><div className="pa-auth-label"><label htmlFor="pa-password">Password</label></div><div className="pa-auth-input"><Lock size={16}/><input id="pa-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete={isRegister ? 'new-password' : 'current-password'}/></div><small>Your password is securely hashed before storage.</small></div>
            <button type="submit" disabled={loading || !username.trim() || !password.trim() || (isRegister && registrationsPaused)} className="pa-auth-submit">{loading ? 'Loading your world…' : isRegister ? (registrationsPaused ? <><ShieldAlert size={16}/> Registrations Paused</> : <><UserPlus size={16}/> Create Account</>) : <><LogIn size={16}/> Sign In</>}</button>
            <div className="pa-auth-switch"><span>{isRegister ? 'Already have an account?' : 'Need an account?'}</span><button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}>{isRegister ? 'Sign in here' : 'Register here'}</button></div>
            <div className="pa-auth-safe"><ShieldCheck size={15}/> Your server credentials stay in your control.</div>
          </form>
          <aside className="pa-auth-art">
            <div className="pa-auth-art-badge"><span/> YOUR OVERWORLD HUB</div>
            <div className="pa-auth-art-copy"><span>ONE LITTLE CONTROL ROOM</span><h3>{isRegister ? 'Make room for one more adventure.' : 'Everything in its right place.'}</h3><p>Keep your Java crew close, wherever you are.</p><ul><li><i/> Server profiles &amp; account groups</li><li><i/> Live chat and connection activity</li><li><i/> Your Termux daemon at a glance</li></ul></div>
            <div className="pa-auth-art-blocks"><b/><b/><b/><b/></div>
          </aside>
        </div>
      </section>
    </div>
  );
};
