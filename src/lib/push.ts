import { supabase } from './supabase';

export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    throw new Error('Notificações push não são suportadas neste navegador.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão negada pelo usuário.');
  }

  // Garante que o Service Worker está registrado e pronto com timeout
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  }

  const workerReady = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado aguardando Service Worker.')), 6000)),
  ]);

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BC0aFbvJ7pvyHEh8gth0Y5grOUXkEMGgKyDN1ouBMA-nVgNKx85ZUIAt7P-Xuv1PxiVCqxzHzgVwpVcUd0rXH7w';

  const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
  const subscription = await (workerReady as ServiceWorkerRegistration).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey as unknown as BufferSource,
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Usuário não autenticado.');
  }

  const subJson = subscription.toJSON();
  const { error: dbError } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subJson.keys?.p256dh || '',
      auth: subJson.keys?.auth || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });

  if (dbError) {
    console.error('Failed to save push subscription in supabase:', dbError);
    throw new Error('Erro ao salvar inscrição no servidor: ' + dbError.message);
  }

  return true;
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    const result = await sub.unsubscribe();
    return result;
  } catch (err) {
    console.error('Unsubscribe failed:', err);
    return false;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

