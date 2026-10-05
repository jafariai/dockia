export type Role = "admin" | "member" | "audience";

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  project_ids: number[];
  created_at: string;
  updated_at: string;
}

// Open-ended service key — the catalog in components/project-links.tsx defines
// the pickable set + icons; any slug is accepted and falls back to a generic icon.
export type LinkType = string;

export interface ProjectLink {
  id: number;
  project: number;
  label: string;
  url: string;
  link_type: LinkType;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  links: ProjectLink[];
  is_archived: boolean;
  created_by: number | null;
  created_by_email: string | null;
  document_count: number;
  member_ids: number[];
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  document_count: number;
}

export interface DocumentItem {
  id: number;
  title: string;
  description: string;
  category: number;
  category_name: string;
  project: number;
  project_name: string;
  owner: number | null;
  owner_email: string | null;
  owner_name: string | null;
  tags: string[];
  file_size: number;
  render_mode: "sanitized" | "interactive";
  preview_url: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRaw {
  id: number;
  title: string;
  render_mode: "sanitized" | "interactive";
  html: string;
}

export interface ApiToken {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

// Returned only by the create endpoint — `token` is the plaintext, shown once.
export interface ApiTokenCreated extends ApiToken {
  token: string;
}

export interface Prompt {
  id: number;
  title: string;
  description: string;
  content: string;
  category: number;
  category_name: string;
  project: number;
  project_name: string;
  owner: number | null;
  owner_email: string | null;
  owner_name: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface StoredFile {
  id: number;
  name: string;
  description: string;
  category: number;
  category_name: string;
  project: number;
  project_name: string;
  owner: number | null;
  owner_email: string | null;
  owner_name: string | null;
  size: number;
  content_type: string;
  original_filename: string;
  download_url: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user: number | null;
  user_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DashboardData {
  total_documents: number;
  documents_this_week: number;
  active_users: number;
  total_projects: number;
  total_categories: number;
  documents_per_project: { project__name: string; project__color: string; count: number }[];
  documents_per_category: { category__name: string; category__color: string; count: number }[];
  recent_documents: DocumentItem[];
  recent_activity: {
    id: number;
    action: string;
    user__email: string | null;
    target_type: string;
    target_id: string;
    timestamp: string;
  }[];
}
