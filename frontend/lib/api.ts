import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { getStoredRefresh, storeRefresh, useAuthStore } from "./auth-store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A single in-flight refresh is shared by all queued requests so we never
// hammer /auth/refresh. On failure we clear the session (forces re-login).
let refreshing: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refresh = getStoredRefresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh });
    useAuthStore.getState().setAccess(data.access);
    if (data.refresh) storeRefresh(data.refresh); // rotation
    return data.access as string;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes("/auth/");

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing || performRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers = original.headers || {};
        (original.headers as Record<string, string>).Authorization =
          `Bearer ${newToken}`;
        return api(original);
      }
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Fetch sanitized preview HTML as text (sends the bearer token). */
export async function fetchPreviewHtml(id: number): Promise<string> {
  const { data } = await api.get(`/documents/${id}/preview`, {
    responseType: "text",
    transformResponse: (v) => v,
  });
  return data as string;
}

/**
 * Download a stored file. Mints a short-lived signed token (authenticated),
 * then points the browser at the download URL so it streams the file straight
 * to disk via Content-Disposition — no buffering the whole file in memory.
 */
export async function downloadStoredFile(id: number): Promise<void> {
  const { data } = await api.get<{ token: string }>(`/files/${id}/download-url`);
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  const href = `${base}/files/${id}/download?token=${encodeURIComponent(data.token)}`;
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  // No `download` attr: the server's Content-Disposition forces the download,
  // which also works cross-origin (local dev hits :8000 from :3000).
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Download a document as an .html file. Uses the existing `raw` endpoint (the
 * original source) and builds the file client-side — no extra backend route.
 */
export async function downloadDocumentHtml(id: number, title: string): Promise<void> {
  const { data } = await api.get<{ html: string }>(`/documents/${id}/raw`);
  const blob = new Blob([data.html ?? ""], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safe = (title || "document").replace(/[^\w.\- ]+/g, "_").trim() || "document";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.detail === "string") return data.detail;
      const first = Object.values(data)[0];
      if (Array.isArray(first)) return String(first[0]);
      if (typeof first === "string") return first;
    }
  }
  return fallback;
}
