/* Integración PWA: service worker, número en el icono e instalación.
 * Todo es opcional: si el navegador no soporta algo, no pasa nada. */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
  standalone?: boolean;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

/** Registra el service worker (sólo en producción: en desarrollo estorba). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}

/** Captura el aviso de instalación de Android/Chrome para mostrarlo cuando toque. */
export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((l) => l());
  });
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  deferredPrompt = null;
  await evt.prompt();
  const choice = await evt.userChoice;
  installListeners.forEach((l) => l());
  return choice.outcome === 'accepted';
}

export function onInstallChange(cb: () => void): () => void {
  installListeners.add(cb);
  return () => void installListeners.delete(cb);
}

/** true si la app se abrió desde el icono (modo instalado). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as BadgeNavigator;
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** Número en el icono: compromisos pendientes hoy. 0 lo quita. */
export function updateAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as BadgeNavigator;
  if (typeof nav.setAppBadge !== 'function') return;
  const p = count > 0 ? nav.setAppBadge(count) : (nav.clearAppBadge?.() ?? nav.setAppBadge(0));
  p.catch(() => undefined);
}
