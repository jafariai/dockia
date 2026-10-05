"use client";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { getStoredRefresh, storeRefresh, useAuthStore } from "@/lib/auth-store";
import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * On first load, re-hydrate the session from the stored refresh token:
 * mint a fresh access token, then fetch the current user. Runs once.
 */
export function AuthBootstrap() {
  const { setAccess, setUser, setInitialized, initialized } = useAuthStore();

  useEffect(() => {
    if (initialized) return;
    (async () => {
      const refresh = getStoredRefresh();
      if (!refresh) {
        setInitialized(true);
        return;
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh });
        setAccess(data.access);
        if (data.refresh) storeRefresh(data.refresh);
        const me = await api.get("/auth/me");
        setUser(me.data);
      } catch {
        useAuthStore.getState().clear();
      } finally {
        setInitialized(true);
      }
    })();
  }, [initialized, setAccess, setUser, setInitialized]);

  return null;
}
