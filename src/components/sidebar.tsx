'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Beaker,
    LayoutDashboard,
    Hammer,
    BookTemplate,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';

const navItems = [
    {
        label: 'Builder',
        href: '/builder',
        icon: Hammer,
        description: 'Create & compile batch prompts',
    },
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Monitor running jobs',
    },
    {
        label: 'Templates',
        href: '/templates',
        icon: BookTemplate,
        description: 'Starter prompt templates',
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen border-r border-border bg-card transition-all duration-300 flex flex-col',
                collapsed ? 'w-16' : 'w-60'
            )}
        >
            {/* Logo */}
            <div className={cn('flex items-center gap-2 px-4 h-16 border-b border-border', collapsed && 'justify-center px-2')}>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
                    <Beaker className="h-4 w-4" />
                </div>
                {!collapsed && (
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-tight">Gemini Bench</span>
                        <span className="text-[10px] text-muted-foreground">Batch Testing Suite</span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;

                    const linkContent = (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                                'hover:bg-accent hover:text-accent-foreground',
                                isActive
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-muted-foreground',
                                collapsed && 'justify-center px-2'
                            )}
                        >
                            <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );

                    if (collapsed) {
                        return (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                                <TooltipContent side="right" className="flex flex-col">
                                    <span className="font-medium">{item.label}</span>
                                    <span className="text-xs text-muted-foreground">{item.description}</span>
                                </TooltipContent>
                            </Tooltip>
                        );
                    }

                    return linkContent;
                })}
            </nav>

            {/* Collapse Toggle */}
            <div className="p-2 border-t border-border">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn('w-full', collapsed && 'px-2')}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
                </Button>
            </div>
        </aside>
    );
}
