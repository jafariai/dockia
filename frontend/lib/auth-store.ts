import { create } from "zustand";
import type { User } from "./types";

const REFRESH_KEY = "idp_refresh";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  initialized: boolean;
  setSession: (access: string, refresh: string, user: User) => void;
  setAccess: (access: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
  setInitialized: (v: boolean) => void;
}

// Access token lives in memory only (not persisted) to limit XSS blast radius.
// The longer-lived refresh token is kept in localStorage so the session can be
// re-hydrated on reload; it is rotated on every use by the backend.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  initialized: false,
  setSession: (access, refresh, user) => {
    if (typeof window !== "undefined") localStorage.setItem(REFRESH_KEY, refresh);
    set({ accessToken: access, user });
  },
  setAccess: (access) => set({ accessToken: access }),
  setUser: (user) => set({ user }),
  clear: () => {
    if (typeof window !== "undefined") localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, user: null });
  },
  setInitialized: (v) => set({ initialized: v }),
}));

export function getStoredRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function storeRefresh(token: string) {
  if (typeof window !== "undefined") localStorage.setItem(REFRESH_KEY, token);
}
