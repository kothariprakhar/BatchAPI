'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatUsd } from '@/lib/cost-calculator';
import { cn } from '@/lib/utils';
import {
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowRight,
    DollarSign,
    Zap,
} from 'lucide-react';
import Link from 'next/link';

export interface Job {
    id: string;
    name: string;
    status: string;
    total_requests: number;
    completed_requests: number;
    failed_requests: number;
    model: string;
    safety_mode: boolean;
    estimated_savings_usd: number;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

const statusConfig = {
    pending: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', label: 'Pending' },
    running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Running' },
    completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Failed' },
    cancelled: { icon: XCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Cancelled' },
} as const;

export function JobCard({ job }: { job: Job }) {
    const config = statusConfig[job.status as keyof typeof statusConfig] ?? statusConfig.pending;
    const StatusIcon = config.icon;
    const progress = job.total_requests > 0
        ? ((job.completed_requests + job.failed_requests) / job.total_requests) * 100
        : 0;

    const elapsed = job.started_at
        ? formatDuration(new Date(job.started_at), job.completed_at ? new Date(job.completed_at) : new Date())
        : null;

    return (
        <div className={cn(
            'group relative rounded-xl border p-5 transition-all',
            'hover:shadow-lg hover:shadow-primary/5',
            config.border,
            'bg-card/50'
        )}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', config.bg)}>
                        <StatusIcon className={cn('h-4 w-4', config.color, job.status === 'running' && 'animate-spin')} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{job.name}</h3>
                        <p className="text-xs text-muted-foreground">{job.model}</p>
                    </div>
                </div>
                <Badge variant="outline" className={cn('text-[10px]', config.color, config.border)}>
                    {config.label}
                </Badge>
            </div>

            {/* Progress Bar */}
            {(job.status === 'running' || job.status === 'completed') && (
                <div className="mb-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{job.completed_requests} / {job.total_requests} completed</span>
                        {job.failed_requests > 0 && (
                            <span className="text-red-400">{job.failed_requests} failed</span>
                        )}
                    </div>
                    <Progress value={progress} className="h-1.5" />
                </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {elapsed && (
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {elapsed}
                    </div>
                )}
                {job.safety_mode && (
                    <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Safety</span>
                    </div>
                )}
                {job.estimated_savings_usd > 0 && (
                    <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">
                            Saved {formatUsd(job.estimated_savings_usd)}
                        </span>
                    </div>
                )}
            </div>

            {/* View Results */}
            {job.status === 'completed' && (
                <div className="mt-4 pt-4 border-t border-border">
                    <Link href={`/results/${job.id}`}>
                        <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                            View Results
                            <ArrowRight className="h-3 w-3" />
                        </Button>
                    </Link>
                </div>
            )}

            {/* Created timestamp */}
            <p className="mt-3 text-[10px] text-muted-foreground/50">
                {new Date(job.created_at).toLocaleString()}
            </p>
        </div>
    );
}

function formatDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}
