import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { ProjectSwitcher } from '@/components/project-switcher';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    BugIcon,
    FlowArrowIcon,
    GaugeIcon,
    HardDrivesIcon,
    PlugIcon,
    PulseIcon,
    ScrollIcon,
    ShieldWarningIcon,
    SquaresFourIcon,
    TreeStructureIcon,
} from '@phosphor-icons/react';
import AppLogo from './app-logo';

export function AppSidebar() {
    const { currentProject } = usePage<SharedData>().props;

    const projectNavItems: NavItem[] = currentProject
        ? [
              { title: 'Dashboard', url: route('projects.show', { project: currentProject.slug }), icon: GaugeIcon, exact: true },
              { title: 'Requests', url: route('requests.index', { project: currentProject.slug }), icon: PulseIcon },
              { title: 'Jobs', url: route('jobs.index', { project: currentProject.slug }), icon: FlowArrowIcon },
              { title: 'Exceptions', url: route('exceptions.index', { project: currentProject.slug }), icon: BugIcon },
              { title: 'Logs', url: route('logs.index', { project: currentProject.slug }), icon: ScrollIcon },
              { title: 'Setup', url: route('projects.setup', { project: currentProject.slug }), icon: PlugIcon },
          ]
        : [];

    const infrastructureNavItems: NavItem[] = [
        { title: 'Projects', url: route('projects.index'), icon: SquaresFourIcon, exact: true },
        { title: 'Hosts & versions', url: route('hosts.index'), icon: HardDrivesIcon },
        { title: 'Vulnerabilities', url: route('security.index'), icon: ShieldWarningIcon },
    ];

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader className="gap-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={route('projects.index')} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <ProjectSwitcher />
            </SidebarHeader>

            <SidebarContent className="gap-4 pt-2">
                {projectNavItems.length > 0 && <NavMain items={projectNavItems} label="Application" />}
                <NavMain items={infrastructureNavItems} label="Infrastructure" />
            </SidebarContent>

            <SidebarFooter>
                <div className="text-muted-foreground flex items-center gap-2 px-2 text-xs group-data-[collapsible=icon]:hidden">
                    <TreeStructureIcon className="size-3.5" /> Self-hosted monitoring
                </div>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
