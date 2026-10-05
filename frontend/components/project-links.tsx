"use client";
import {
  Activity,
  BadgeDollarSign,
  Bug,
  ExternalLink,
  Facebook,
  FileText,
  Figma,
  Gauge,
  Github,
  Gitlab,
  Globe,
  Instagram,
  Linkedin,
  Link2,
  LineChart,
  Mail,
  Megaphone,
  NotebookText,
  Rocket,
  Search,
  Share2,
  Slack,
  SquareKanban,
  Store,
  Tag,
  TrendingUp,
  Users,
  Workflow,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { LinkType, ProjectLink } from "@/lib/types";

export interface LinkTypeDef {
  value: LinkType;
  label: string;
  icon: LucideIcon;
  group: string;
}

// The catalog of service integrations a project can link to. Adding a new one
// is just a row here — no backend migration (link_type is an open slug).
export const LINK_TYPES: LinkTypeDef[] = [
  { value: "figma", label: "Figma", icon: Figma, group: "Design & Product" },
  { value: "linear", label: "Linear", icon: Workflow, group: "Design & Product" },
  { value: "notion", label: "Notion", icon: NotebookText, group: "Design & Product" },
  { value: "jira", label: "Jira", icon: SquareKanban, group: "Design & Product" },
  { value: "confluence", label: "Confluence", icon: FileText, group: "Design & Product" },

  { value: "github", label: "GitHub", icon: Github, group: "Engineering" },
  { value: "gitlab", label: "GitLab", icon: Gitlab, group: "Engineering" },
  { value: "sentry", label: "Sentry", icon: Bug, group: "Engineering" },
  { value: "vercel", label: "Vercel / Deploy", icon: Rocket, group: "Engineering" },

  { value: "search_console", label: "Google Search Console", icon: Search, group: "SEO & Analytics" },
  { value: "google_analytics", label: "Google Analytics", icon: LineChart, group: "SEO & Analytics" },
  { value: "tag_manager", label: "Google Tag Manager", icon: Tag, group: "SEO & Analytics" },
  { value: "bing_webmaster", label: "Bing Webmaster", icon: Search, group: "SEO & Analytics" },
  { value: "ahrefs", label: "Ahrefs", icon: TrendingUp, group: "SEO & Analytics" },
  { value: "semrush", label: "SEMrush", icon: Activity, group: "SEO & Analytics" },
  { value: "pagespeed", label: "PageSpeed Insights", icon: Gauge, group: "SEO & Analytics" },

  { value: "google_ads", label: "Google Ads", icon: Megaphone, group: "Marketing" },
  { value: "meta_ads", label: "Meta Ads", icon: BadgeDollarSign, group: "Marketing" },
  { value: "mailchimp", label: "Email / Mailchimp", icon: Mail, group: "Marketing" },
  { value: "hubspot", label: "HubSpot / CRM", icon: Users, group: "Marketing" },
  { value: "google_business", label: "Google Business Profile", icon: Store, group: "Marketing" },

  { value: "linkedin", label: "LinkedIn", icon: Linkedin, group: "Social" },
  { value: "twitter", label: "X / Twitter", icon: Share2, group: "Social" },
  { value: "instagram", label: "Instagram", icon: Instagram, group: "Social" },
  { value: "youtube", label: "YouTube", icon: Youtube, group: "Social" },
  { value: "facebook", label: "Facebook", icon: Facebook, group: "Social" },

  { value: "slack", label: "Slack", icon: Slack, group: "General" },
  { value: "website", label: "Website", icon: Globe, group: "General" },
  { value: "doc", label: "Document", icon: FileText, group: "General" },
  { value: "other", label: "Other", icon: Link2, group: "General" },
];

const BY_VALUE: Record<string, LinkTypeDef> = Object.fromEntries(
  LINK_TYPES.map((t) => [t.value, t])
);

export function linkIcon(type: LinkType): LucideIcon {
  return BY_VALUE[type]?.icon ?? Link2;
}

export function linkTypeLabel(type: LinkType): string {
  return BY_VALUE[type]?.label ?? type;
}

/** Catalog grouped for an <optgroup>-style picker, preserving definition order. */
export const LINK_TYPE_GROUPS: { group: string; items: LinkTypeDef[] }[] = (() => {
  const order: string[] = [];
  const map = new Map<string, LinkTypeDef[]>();
  for (const t of LINK_TYPES) {
    if (!map.has(t.group)) {
      map.set(t.group, []);
      order.push(t.group);
    }
    map.get(t.group)!.push(t);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
})();

/** Read-only chips for a project's external links, opening in a new tab. */
export function ProjectLinks({ links }: { links: ProjectLink[] }) {
  if (!links?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => {
        const Icon = linkIcon(l.link_type);
        return (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs transition-colors hover:bg-accent"
            title={`${linkTypeLabel(l.link_type)} — ${l.url}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[10rem] truncate">{l.label}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
