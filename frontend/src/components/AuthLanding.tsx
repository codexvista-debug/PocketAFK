'use client';

import React from 'react';
import { ArrowRight, AudioLines, Box, Check, ShieldCheck, Sparkles } from 'lucide-react';

function Cube({ className = '' }: { className?: string }) {
  return <div className={`pa-cube ${className}`} aria-hidden="true"><i className="pa-face pa-front"/><i className="pa-face pa-right"/><i className="pa-face pa-top"/></div>;
}

function Tree({ className = '' }: { className?: string }) {
  return <div className={`pa-tree ${className}`} aria-hidden="true"><div className="pa-leaves"><i/><i/><i/></div><div className="pa-trunk"/></div>;
}

function HeroScene() {
  return (
    <div className="pa-scene" aria-label="A floating block-built Minecraft island with trees and a glowing portal">
      <div className="pa-scene-sky" />
      <div className="pa-cloud pa-cloud-one"/><div className="pa-cloud pa-cloud-two"/>
      <div className="pa-sun" />
      <div className="pa-island">
        <div className="pa-island-grass"/><div className="pa-island-dirt"/><div className="pa-island-stone"/>
        <Tree className="pa-tree-left"/><Tree className="pa-tree-right"/><Tree className="pa-tree-back"/>
        <div className="pa-portal"><span/><b/><b/><b/><b/><b/><b/><b/><b/><b/><b/><b/><b/><b/><b/><b/><b/></div>
        <Cube className="pa-rock pa-rock-one"/><Cube className="pa-rock pa-rock-two"/>
        <div className="pa-grass-tuft pa-tuft-one"/><div className="pa-grass-tuft pa-tuft-two"/><div className="pa-grass-tuft pa-tuft-three"/>
      </div>
      <div className="pa-orbit pa-orbit-one"/><div className="pa-orbit pa-orbit-two"/>
      <div className="pa-float-cube pa-float-one"><Cube/></div><div className="pa-float-cube pa-float-two"><Cube/></div>
      <div className="pa-scene-caption"><span className="pa-caption-icon"><Sparkles size={14}/></span><div><b>YOUR WORLD, ON YOUR TERMS</b><small>JAVA EDITION · ALWAYS IN REACH</small></div></div>
    </div>
  );
}

export function AuthLanding({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="pa-landing">
      <div className="pa-atmosphere" aria-hidden="true" />
      <header className="pa-nav">
        <a href="/" className="pa-brand" aria-label="PocketAFK home"><span className="pa-brand-mark"><img src="/pocketafk-emblem.png" alt=""/></span><span className="pa-brand-copy"><b>PocketAFK</b><small>JAVA CONTROL DECK</small></span></a>
        <div className="pa-nav-right"><span className="pa-edition-pill"><span/> MADE FOR JAVA</span><button onClick={onSignIn} className="pa-nav-login">Sign in <ArrowRight size={15}/></button></div>
      </header>

      <section className="pa-hero">
        <div className="pa-copy">
          <div className="pa-eyebrow"><span/> YOUR WORLD, UNDER CONTROL</div>
          <h1>Keep your<br/>world <em>moving.</em></h1>
          <p className="pa-intro">One home for your <strong>Java accounts</strong>, server profiles, live chat, and the Termux daemon that keeps your crew online.</p>
          <button onClick={onSignIn} className="pa-primary-cta"><span className="pa-cta-icon"><ArrowRight size={17}/></span><span>Sign in or create an account<small>Your next adventure is one click away</small></span><ArrowRight className="pa-cta-arrow" size={18}/></button>
          <div className="pa-trust"><ShieldCheck size={16}/> Your server credentials stay in your control.</div>
          <div className="pa-feature-row"><span><Box size={14}/> JAVA EDITION</span><i/><span><AudioLines size={14}/> TERMUX READY</span><i/><span><Check size={14}/> YOUR OWN ACCOUNTS</span></div>
        </div>
        <div className="pa-art-wrap"><div className="pa-art-kicker"><span className="pa-live-dot"/> POCKETAFK · JAVA CORE</div><HeroScene/><div className="pa-art-card"><div className="pa-card-tag"><span/> JAVA AFK CREW</div><h2>Adventure<br/>doesn’t have to log off.</h2><p>Manage your worlds from one cozy control room.</p><div className="pa-block-meter">{[0,1,2,3,4,5,6].map((x)=><span key={x}/>)}</div></div><div className="pa-scene-glow"/></div>
      </section>

      <footer className="pa-footer"><span>BUILT FOR YOUR LITTLE CORNER OF THE OVERWORLD</span><span>POCKETAFK <i>/</i> JAVA EDITION</span></footer>
    </main>
  );
}
