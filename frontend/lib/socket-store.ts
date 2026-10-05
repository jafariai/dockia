"use client";
import { create } from "zustand";

// Whether the realtime websocket is currently open. The recent-activity queries
// read this to fall back to polling only while the socket is down (when it's up,
// websocket invalidation keeps the badges fresh, so no polling is needed).
interface SocketState {
  connected: boolean;
  setConnected: (v: boolean) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),
}));
