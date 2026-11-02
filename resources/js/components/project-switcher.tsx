import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { CaretUpDownIcon, PlusIcon, SquaresFourIcon } from '@phosphor-icons/react';

/**
 * Dropdown to jump between monitored projects.
 */
export function ProjectSwitcher() {
    const { projects, currentProject } = usePage<SharedData>().props;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent border">
                            <div className="grid flex-1 text-left leading-tight">
                                <span className="truncate text-sm font-semibold">{currentProject?.name ?? 'All projects'}</span>
                                <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                                    {currentProject ? (
                                        <>
                                            <span className="bg-signal-accent size-1.5 rounded-full" />
                                            {currentProject.environment}
                                        </>
                                    ) : (
                                        `${projects.length} monitored`
                                    )}
                                </span>
                            </div>
                            <CaretUpDownIcon className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56" align="start">
                        <DropdownMenuLabel className="text-muted-foreground text-xs">Projects</DropdownMenuLabel>
                        {projects.map((project) => (
                            <DropdownMenuItem key={project.id} asChild>
                                <Link href={route('projects.show', { project: project.slug })} className="flex justify-between gap-3">
                                    <span className="truncate">{project.name}</span>
                                    <span className="text-muted-foreground text-xs">{project.environment}</span>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href={route('projects.index')}>
                                <SquaresFourIcon /> All projects
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={route('projects.index', { create: 1 })}>
                                <PlusIcon /> New project
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
