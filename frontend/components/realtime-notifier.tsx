"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { useNotifStore } from "@/lib/notif-store";
import { useSocketStore } from "@/lib/socket-store";
import { useRecentDocuments, useRecentFiles } from "@/lib/hooks";
import { subscribeToPush } from "@/lib/push";

/** Build the websocket URL from the configured API base. nginx routes /ws/ at
 *  the root, so we use the API's ORIGIN only (any path prefix on the base is
 *  irrelevant) and just swap http(s)→ws(s). */
function wsUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  let origin: string;
  if (base.startsWith("http")) {
    const u = new URL(base);
    origin = `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
  } else {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    origin = `${proto}//${window.location.host}`;
  }
  return `${origin}/ws/notifications?token=${encodeURIComponent(token)}`;
}

/**
 * Mounted once in the app layout. Opens a websocket and, on a "new document/file"
 * event from a teammate, fires an instant toast + browser notification and
 * refreshes the nav badges. Also keeps the recent-activity polling alive as a
 * fallback for the badges when the socket is down.
 */
export function RealtimeNotifier() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const enabled = useNotifStore((s) => s.enabled);
  const setConnected = useSocketStore((s) => s.setConnected);
  const qc = useQueryClient();

  useRecentDocuments();
  useRecentFiles();

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Register this browser for closed-tab web push when notifications are on and
  // permission is granted (re-runs after login so the subscription stays fresh).
  useEffect(() => {
    if (!accessToken || !enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    void subscribeToPush();
  }, [accessToken, enabled]);

  useEffect(() => {
    if (!accessToken) return;
    let closed = false;
    let retries = 0;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    // Coalesce a rapid burst of events so a bulk upload doesn't fire a wall of
    // toasts/notifications. Flush on a short quiet gap (or once the buffer fills).
    type Burst = { label: string; title: string; who: string; kind?: string; id?: number };
    let buffer: Burst[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    function osNotify(heading: string, body: string, tag: string) {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }
      try {
        new Notification(heading, { body, tag });
      } catch {
        /* notifications can throw when backgrounded — ignore */
      }
    }

    function flushBurst() {
      flushTimer = undefined;
      const items = buffer;
      buffer = [];
      if (items.length === 0) return;
      if (items.length <= 3) {
        items.forEach((it) => {
          toast(`New ${it.label}: ${it.title}${it.who}`);
          osNotify(`New ${it.label}`, `${it.title}${it.who}`, `dockia-${it.kind}-${it.id}`);
        });
        return;
      }
      const docs = items.filter((i) => i.label === "document").length;
      const files = items.filter((i) => i.label === "file").length;
      const parts: string[] = [];
      if (docs) parts.push(`${docs} new document${docs > 1 ? "s" : ""}`);
      if (files) parts.push(`${files} new file${files > 1 ? "s" : ""}`);
      const summary = parts.join(" · ");
      toast(summary);
      osNotify("New activity", summary, "dockia-activity-burst");
    }

    function connect() {
      // Read the freshest token each attempt so a reconnect after an expiry
      // close uses the refreshed token (not the one captured at effect start).
      const token = useAuthStore.getState().accessToken;
      if (!token) return;
      socket = new WebSocket(wsUrl(token));

      socket.onopen = () => {
        retries = 0;
        setConnected(true);
      };

      socket.onmessage = (e) => {
        let data: {
          type?: string;
          kind?: string;
          id?: number;
          title?: string;
          owner_id?: number | null;
          owner_email?: string | null;
        };
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        if (data.type !== "activity.created") return;
        if (data.owner_id === userIdRef.current) return; // skip our own

        // Instant badge refresh — always, even when alerts are turned off.
        qc.invalidateQueries({ queryKey: ["recent-documents"] });
        qc.invalidateQueries({ queryKey: ["recent-files"] });

        // Respect the user's notification preference for the toast AND the OS
        // notification (off → silent, badges only).
        if (!enabledRef.current) return;

        const label = data.kind === "file" ? "file" : "document";
        const who = data.owner_email ? ` by ${data.owner_email}` : "";
        const title = data.title || "Untitled";
        buffer.push({ label, title, who, kind: data.kind, id: data.id });
        if (flushTimer) clearTimeout(flushTimer);
        if (buffer.length >= 10) flushBurst();
        else flushTimer = setTimeout(flushBurst, 600);
      };

      socket.onclose = () => {
        socket = null;
        setConnected(false);
        if (closed) return;
        const delay = Math.min(30_000, 1000 * 2 ** retries);
        retries += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => socket?.close();
    }

    connect();
    return () => {
      closed = true;
      setConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (flushTimer) clearTimeout(flushTimer);
      socket?.close();
    };
  }, [accessToken, qc, setConnected]);

  return null;
}
