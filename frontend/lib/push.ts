"use client";
import { api } from "./api";

// Wires the browser up to the backend Web Push endpoints (apps/realtime).
// Best-effort throughout: every function degrades to a no-op (never throws) when
// push isn't available — no service worker (e.g. `next dev`), unsupported
// browser, blocked permission, or Redis/VAPID not provisioned on the server.

/** Decode a base64url VAPID key into the Uint8Array pushManager.subscribe wants. */
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Subscribe this browser to web push and register it with the backend.
 *  Returns false (without throwing) if push isn't available. */
export async function subscribeToPush(): Promise<boolean> {
  const reg = await readyRegistration();
  if (!reg) return false;
  try {
    const { data } = await api.get<{ publicKey: string }>("/push/vapid-key");
    if (!data.publicKey) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }
    await api.post("/push/subscribe", { subscription: sub.toJSON() });
    return true;
  } catch {
    return false;
  }
}

/** Remove this browser's push subscription (backend + browser). Best-effort. */
export async function unsubscribeFromPush(): Promise<void> {
  const reg = await readyRegistration();
  if (!reg) return;
  try {
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch {
    /* ignore */
  }
}
