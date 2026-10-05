"use client";
import { create } from "zustand";

// Notification preferences + "last seen" markers live entirely in the browser
// (localStorage) — they are per-device, so nothing is stored server-side.

export type ActivityKind = "documents" | "files";

const ENABLED_KEY = "dockia:notif:enabled";
const SEEN_KEY = "dockia:notif:seen";

function loadSeen(): Record<ActivityKind, string> {
  if (typeof window === "undefined") return { documents: "", files: "" };
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) return { documents: "", files: "", ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  // First run: treat everything that already exists as "seen" so the badge
  // doesn't light up for the whole back-catalogue.
  const now = new Date().toISOString();
  const init = { documents: now, files: now };
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(init));
  } catch {
    /* ignore */
  }
  return init;
}

interface NotifState {
  enabled: boolean;
  seen: Record<ActivityKind, string>;
  setEnabled: (v: boolean) => void;
  markSeen: (kind: ActivityKind) => void;
}

export const useNotifStore = create<NotifState>((set, get) => ({
  enabled:
    typeof window !== "undefined" && localStorage.getItem(ENABLED_KEY) === "1",
  seen: loadSeen(),
  setEnabled: (v) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ENABLED_KEY, v ? "1" : "0");
    }
    set({ enabled: v });
  },
  markSeen: (kind) => {
    const seen = { ...get().seen, [kind]: new Date().toISOString() };
    if (typeof window !== "undefined") {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }
    set({ seen });
  },
}));
