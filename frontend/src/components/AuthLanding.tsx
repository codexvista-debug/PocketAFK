'use client';

import React from 'react';
import { ArrowRight, AudioLines, Box, Check, ShieldCheck } from 'lucide-react';
import { SitePreview } from './SitePreview';

export function AuthLanding({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="pa-landing">
      {/* Nostalgic Cozy Overworld Background */}
      <div className="pa-atmosphere" aria-hidden="true" />

      {/* Navigation Header */}
      <header className="pa-nav">
        <a href="/" className="pa-brand" aria-label="PocketAFK home">
          <span className="pa-brand-mark">
            <img src="/pocketafk-emblem.png" alt="PocketAFK" />
          </span>
          <span className="pa-brand-copy">
            <b>PocketAFK</b>
            <small>JAVA CONTROL DECK</small>
          </span>
        </a>
        <div className="pa-nav-right">
          <span className="pa-edition-pill">
            <span /> MADE FOR JAVA
          </span>
          <button onClick={onSignIn} className="pa-nav-login cursor-pointer">
            Sign in <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pa-hero">
        <div className="pa-copy">
          <div className="pa-eyebrow">
            <span /> YOUR WORLD, UNDER CONTROL
          </div>
          <h1>
            Keep your<br />world <em>moving.</em>
          </h1>
          <p className="pa-intro">
            One home for your <strong>Java accounts</strong>, server profiles, live chat, and the Termux daemon that keeps your crew online 24/7.
          </p>
          <button onClick={onSignIn} className="pa-primary-cta cursor-pointer">
            <span className="pa-cta-icon">
              <ArrowRight size={17} />
            </span>
            <span>
              Sign in or create an account
              <small>Your next adventure is one click away</small>
            </span>
            <ArrowRight className="pa-cta-arrow" size={18} />
          </button>
          <div className="pa-trust">
            <ShieldCheck size={16} /> Your server credentials stay in your control.
          </div>
          <div className="pa-feature-row">
            <span><Box size={14} /> JAVA EDITION</span>
            <i />
            <span><AudioLines size={14} /> TERMUX READY</span>
            <i />
            <span><Check size={14} /> YOUR OWN ACCOUNTS</span>
          </div>
        </div>

        {/* Right Hero Showcase Element: Creative, eye-catching Live Command Deck */}
        <div className="pa-showcase-wrapper">
          <SitePreview onSignIn={onSignIn} />
        </div>
      </section>

      {/* Footer */}
      <footer className="pa-footer">
        <span>BUILT FOR YOUR LITTLE CORNER OF THE OVERWORLD</span>
        <span>POCKETAFK <i>/</i> JAVA EDITION</span>
      </footer>
    </main>
  );
}
