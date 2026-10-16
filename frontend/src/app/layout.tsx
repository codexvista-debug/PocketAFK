import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PocketAFK - Minecraft AFK Dashboard',
  description: 'Pure Java Mineflayer Stack running 24/7 on Android Termux',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
