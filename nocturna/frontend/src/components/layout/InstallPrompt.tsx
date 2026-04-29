'use client';
import { useEffect, useState } from 'react';
import { capture } from '@/lib/analytics';

interface BeforeInstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'nocturna.install_dismissed_at';
// Re-show prompt at most once a week.
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7;

export default function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallEvent | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const last = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (last && Date.now() - last < COOLDOWN_MS) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallEvent);
      setShown(true);
      capture('install_prompt_shown');
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    window.addEventListener('appinstalled', () => {
      capture('app_installed');
      setShown(false);
    });
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    capture('install_prompt_dismissed');
    setShown(false);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    capture('install_prompt_choice', { outcome: choice.outcome });
    setShown(false);
  }

  if (!shown || !event) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-sm z-50 card !p-4 shadow-2xl border-gold-500/40 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="font-display text-2xl text-gold-400">🌙</div>
        <div className="flex-1">
          <p className="font-medium text-gold-400">Install Nocturna</p>
          <p className="text-xs text-gold-400/70 mt-1">
            One-tap planning, offline access, no app store required.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={install} className="btn btn-primary !py-1.5 !px-3 text-sm">Install</button>
            <button onClick={dismiss} className="btn btn-ghost !py-1.5 !px-3 text-sm">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
