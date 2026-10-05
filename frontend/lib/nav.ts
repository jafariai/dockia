import {
  FileText,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  MessageSquareText,
  ScrollText,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  hideForAudience?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/prompts", label: "Prompts", icon: MessageSquareText },
  { href: "/files", label: "Files", icon: HardDrive, hideForAudience: true },
  { href: "/projects", label: "Projects", icon: FolderKanban, hideForAudience: true },
  { href: "/categories", label: "Categories", icon: Tags, hideForAudience: true },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/logs", label: "Audit Logs", icon: ScrollText, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** New-item badge count for a nav item, given the per-section new counts. */
export function navBadgeFor(
  href: string,
  counts: { documents: number; files: number }
): number {
  if (href === "/documents") return counts.documents;
  if (href === "/files") return counts.files;
  return 0;
}

/** Filter nav items by the current user's role. */
export function navForRole(role: Role | undefined): NavItem[] {
  const isAdmin = role === "admin";
  const isAudience = role === "audience";
  return NAV.filter(
    (i) => (!i.adminOnly || isAdmin) && !(i.hideForAudience && isAudience)
  );
}
