"use client";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, fetchPreviewHtml } from "./api";
import { useAuthStore } from "./auth-store";
import { useNotifStore } from "./notif-store";
import { useSocketStore } from "./socket-store";
import type {
  ApiToken,
  ApiTokenCreated,
  AuditLog,
  Category,
  DashboardData,
  DocumentItem,
  DocumentRaw,
  LinkType,
  Paginated,
  Project,
  ProjectLink,
  Prompt,
  StoredFile,
  User,
} from "./types";

// --- Dashboard -------------------------------------------------------------
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/dashboard/")).data,
  });
}

// --- Activity / notifications (client-side, polls existing endpoints) ------
const RECENT_PARAMS = { ordering: "-created_at", page_size: 20 };

export function useRecentDocuments() {
  // Only poll while the websocket is down — when it's up, realtime invalidation
  // keeps this fresh, so the 60s timer is pure waste.
  const socketConnected = useSocketStore((s) => s.connected);
  return useQuery({
    queryKey: ["recent-documents"],
    queryFn: async () =>
      (await api.get<Paginated<DocumentItem>>("/documents", { params: RECENT_PARAMS }))
        .data.results,
    refetchInterval: socketConnected ? false : 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

export function useRecentFiles() {
  const socketConnected = useSocketStore((s) => s.connected);
  return useQuery({
    queryKey: ["recent-files"],
    queryFn: async () =>
      (await api.get<Paginated<StoredFile>>("/files", { params: RECENT_PARAMS }))
        .data.results,
    refetchInterval: socketConnected ? false : 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

/** Count of items created by *other* users since the last time the user viewed
 *  each section — drives the "N new" nav badges. */
export function useNewCounts() {
  const userId = useAuthStore((s) => s.user?.id);
  const seen = useNotifStore((s) => s.seen);
  const { data: docs } = useRecentDocuments();
  const { data: files } = useRecentFiles();

  const countNew = (
    items: { created_at: string; owner: number | null }[] | undefined,
    since: string
  ) =>
    (items || []).filter(
      (i) => i.owner !== userId && (!since || new Date(i.created_at) > new Date(since))
    ).length;

  return {
    documents: countNew(docs, seen.documents),
    files: countNew(files, seen.files),
  };
}

// --- Documents -------------------------------------------------------------
export interface DocumentFilters {
  search?: string;
  owner?: number;
  category?: number;
  project?: number;
  date?: string;
  created_after?: string;
  created_before?: string;
  ordering?: string;
  page?: number;
}

export function useDocuments(filters: DocumentFilters) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
  );
  return useQuery({
    queryKey: ["documents", params],
    queryFn: async () =>
      (await api.get<Paginated<DocumentItem>>("/documents", { params })).data,
  });
}

export function useDocument(id: number) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: async () => (await api.get<DocumentItem>(`/documents/${id}`)).data,
    enabled: Number.isFinite(id),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FormData) =>
      (await api.post<DocumentItem>("/documents", form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<DocumentItem> }) =>
      (await api.patch<DocumentItem>(`/documents/${id}`, data)).data,
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", doc.id] });
    },
  });
}

/** Cached preview HTML for card thumbnails (shared across mounts, lazy). */
export function useDocumentPreview(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["preview", id],
    queryFn: () => fetchPreviewHtml(id),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

/** Editable HTML source for the in-app code editor. */
export function useDocumentRaw(id: number) {
  return useQuery({
    queryKey: ["document-raw", id],
    queryFn: async () => (await api.get<DocumentRaw>(`/documents/${id}/raw`)).data,
    enabled: Number.isFinite(id),
    staleTime: 0,
  });
}

/** Save edited HTML source back to a document (re-sanitizes server-side). */
export function useSaveDocumentHtml() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, html }: { id: number; html: string }) =>
      (await api.patch<DocumentItem>(`/documents/${id}`, { html_content: html })).data,
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", doc.id] });
      qc.invalidateQueries({ queryKey: ["document-raw", doc.id] });
    },
  });
}

/** Replace a document's HTML by uploading a new file (multipart, re-sanitized). */
export function useReplaceDocumentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const form = new FormData();
      form.append("html_file", file);
      return (await api.patch<DocumentItem>(`/documents/${id}`, form)).data;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", doc.id] });
      qc.invalidateQueries({ queryKey: ["document-raw", doc.id] });
      qc.invalidateQueries({ queryKey: ["preview", doc.id] });
    },
  });
}

// --- Prompts (shared instructions) -----------------------------------------
export interface PromptFilters {
  search?: string;
  project?: number;
  category?: number;
  owner?: number;
  ordering?: string;
  page?: number;
}

export function usePrompts(filters: PromptFilters) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
  );
  return useQuery({
    queryKey: ["prompts", params],
    queryFn: async () =>
      (await api.get<Paginated<Prompt>>("/prompts", { params })).data,
  });
}

export function usePrompt(id: number) {
  return useQuery({
    queryKey: ["prompt", id],
    queryFn: async () => (await api.get<Prompt>(`/prompts/${id}`)).data,
    enabled: Number.isFinite(id),
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Prompt>) =>
      (await api.post<Prompt>("/prompts", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Prompt> }) =>
      (await api.patch<Prompt>(`/prompts/${id}`, data)).data,
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      qc.invalidateQueries({ queryKey: ["prompt", p.id] });
    },
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/prompts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

// --- Files (backups / assets) ----------------------------------------------
export interface FileFilters {
  search?: string;
  project?: number;
  category?: number;
  ordering?: string;
  page?: number;
}

export function useFiles(filters: FileFilters) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
  );
  return useQuery({
    queryKey: ["files", params],
    queryFn: async () =>
      (await api.get<Paginated<StoredFile>>("/files", { params })).data,
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FormData) =>
      (await api.post<StoredFile>("/files", form)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/files/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
}

// --- Projects --------------------------------------------------------------
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (await api.get<Paginated<Project>>("/projects", { params: { page_size: 100 } }))
        .data.results,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Project>) =>
      (await api.post<Project>("/projects", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<Project>) =>
      (await api.patch<Project>(`/projects/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.post(`/projects/${id}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUnarchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.post(`/projects/${id}/unarchive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      // Deleting a project cascades to its docs/files/prompts — refresh broadly.
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}

export function useAssignMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, user_ids }: { id: number; user_ids: number[] }) =>
      api.post(`/projects/${id}/members`, { user_ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

// --- Project links (Figma / Linear / repo / …) -----------------------------
export function useProjectLinks(projectId?: number) {
  return useQuery({
    queryKey: ["project-links", projectId],
    queryFn: async () =>
      (
        await api.get<Paginated<ProjectLink>>("/project-links", {
          params: { project: projectId, page_size: 100 },
        })
      ).data.results,
    enabled: !!projectId,
  });
}

export function useCreateProjectLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      project: number;
      label: string;
      url: string;
      link_type: LinkType;
    }) => (await api.post<ProjectLink>("/project-links", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-links"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProjectLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/project-links/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-links"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// --- Categories ------------------------------------------------------------
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await api.get<Paginated<Category>>("/categories", { params: { page_size: 100 } }))
        .data.results,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; color?: string }) =>
      (await api.post<Category>("/categories", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<Category>) =>
      (await api.patch<Category>(`/categories/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// --- Users (admin) ---------------------------------------------------------
export function useUsers(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["users"],
    queryFn: async () =>
      (await api.get<Paginated<User>>("/users", { params: { page_size: 200 } }))
        .data.results,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<User>("/users", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      (await api.patch<User>(`/users/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) =>
      api.post(`/users/${id}/reset-password`, { password }),
  });
}

// --- API tokens (service credentials for the MCP server) -------------------
export function useApiTokens() {
  return useQuery({
    queryKey: ["api-tokens"],
    queryFn: async () => (await api.get<ApiToken[]>("/auth/tokens")).data,
  });
}

export function useCreateApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<ApiTokenCreated>("/auth/tokens", { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-tokens"] }),
  });
}

export function useRevokeApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/auth/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-tokens"] }),
  });
}

// --- Audit logs (admin) ----------------------------------------------------
export function useLogs(filters: { action?: string; search?: string; page?: number }) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
  );
  return useQuery({
    queryKey: ["logs", params],
    queryFn: async () =>
      (await api.get<Paginated<AuditLog>>("/logs", { params })).data,
  });
}
