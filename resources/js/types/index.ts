import { type Icon as PhosphorIcon } from '@phosphor-icons/react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: PhosphorIcon | null;
    isActive?: boolean;
    exact?: boolean;
}

export interface ProjectSummary {
    id: number;
    name: string;
    slug: string;
    environment: string;
    last_seen_at?: string | null;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    projects: ProjectSummary[];
    currentProject: ProjectSummary | null;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}

export * from './signal';
