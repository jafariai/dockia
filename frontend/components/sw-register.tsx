"use client";
import { useEffect } from "react";

/**
 * Registers the service worker — production only. In `next dev` a SW would
 * cache HMR chunks and serve stale code, so we skip it there. To test the PWA
 * locally, run `npm run build && npm run start`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
