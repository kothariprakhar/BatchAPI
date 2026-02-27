'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase, getDeviceId } from '@/lib/supabase';
import { JobCard, getQueueStatus, type Job } from '@/components/job-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, RefreshCw, Inbox, GitCompare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useApiKey } from '@/lib/api-key-context';

export default function DashboardPage() {
    const { apiKey } = useApiKey();
    const [deviceId] = useState<string>(() =>
        typeof window === 'undefined' ? '' : getDeviceId()
    );
    const [actionJobId, setActionJobId] = useState<string | null>(null);

    const { data: jobs, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['jobs', deviceId],
        queryFn: async (): Promise<Job[]> => {
            if (!deviceId) return [];

            // First get projects for this device
            const { data: projects } = await supabase
                .from('projects')
                .select('id')
                .eq('device_id', deviceId);

            if (!projects?.length) return [];

            const projectIds = projects.map((p) => p.id);

            const { data, error } = await supabase
                .from('batch_jobs')
                .select('*')
                .in('project_id', projectIds)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data as Job[]) ?? [];
        },
        enabled: !!deviceId,
        refetchInterval: 30000, // Poll every 30 seconds
    });
    const { data: compareSessions } = useQuery({
        queryKey: ['compare-sessions', deviceId],
        queryFn: async (): Promise<CompareSession[]> => {
            if (!deviceId) return [];

            const { data: projects } = await supabase
                .from('projects')
                .select('id')
                .eq('device_id', deviceId);

            if (!projects?.length) return [];
            const projectIds = projects.map((project) => project.id);

            const { data, error } = await supabase
                .from('compare_sessions')
                .select('*')
                .in('project_id', projectIds)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const sessions = (data as CompareSession[]) ?? [];
            const refreshed = await Promise.all(
                sessions.map(async (session) => {
                    const response = await fetch(`/api/compare/${session.id}`);
                    if (!response.ok) return session;
                    const payload = await response.json();
                    return {
                        ...session,
                        status: payload.status ?? session.status,
                        total_cases: payload.total_cases ?? session.total_cases,
                        completed_cases: payload.completed_cases ?? session.completed_cases,
                        failed_cases: payload.failed_cases ?? session.failed_cases,
                    } as CompareSession;
                })
            );
            return refreshed;
        },
        enabled: !!deviceId,
        refetchInterval: 30000,
    });

    const hasRunningJobs = jobs?.some((j) => {
        const queueStatus = getQueueStatus(j);
        return queueStatus === 'queued' || queueStatus === 'running' || queueStatus === 'paused' || queueStatus === 'retry_wait';
    });
    const hasRunningCompareSessions = compareSessions?.some((session) =>
        ['queued', 'running'].includes(session.status)
    );
    const activeJobIds = useMemo(
        () =>
            (jobs ?? [])
                .filter((j) => {
                    const queueStatus = getQueueStatus(j);
                    return (
                        queueStatus === 'queued' ||
                        queueStatus === 'running' ||
                        queueStatus === 'paused' ||
                        queueStatus === 'retry_wait'
                    );
                })
                .map((j) => j.id),
        [jobs]
    );

    useEffect(() => {
        if (!activeJobIds.length) return;
        const sources = activeJobIds.map((jobId) => {
            const source = new EventSource(`/api/jobs/${jobId}/events`);
            source.onmessage = () => {
                void refetch();
            };
            source.onerror = () => {
                source.close();
            };
            return source;
        });

        return () => {
            for (const source of sources) {
                source.close();
            }
        };
    }, [activeJobIds, refetch]);

    const handleCancelJob = async (job: Job) => {
        setActionJobId(job.id);
        try {
            await fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
            await refetch();
        } finally {
            setActionJobId(null);
        }
    };

    const handleResumeJob = async (job: Job) => {
        setActionJobId(job.id);
        try {
            const body = apiKey ? { apiKey } : {};
            await fetch(`/api/jobs/${job.id}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await refetch();
        } finally {
            setActionJobId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
                        <LayoutDashboard className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Jobs Dashboard</h1>
                        <p className="text-sm text-muted-foreground">
                            Monitor batch job progress and view results
                            {(hasRunningJobs || hasRunningCompareSessions) && (
                                <span className="ml-2 text-blue-400">• Auto-refreshing every 30s</span>
                            )}
                        </p>
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    className="gap-2"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Job Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 rounded-xl" />
                    ))}
                </div>
            ) : jobs && jobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {jobs.map((job) => (
                        <JobCard
                            key={job.id}
                            job={job}
                            onCancel={handleCancelJob}
                            onResume={handleResumeJob}
                            actionBusy={actionJobId === job.id}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-border p-16 text-center">
                    <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium mb-1">No batch jobs yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Go to the Builder to create and run your first batch prompt test.
                    </p>
                    <Link href="/builder">
                        <Button variant="outline" className="gap-2">
                            Open Builder
                        </Button>
                    </Link>
                </div>
            )}

            {/* Compare Sessions */}
            {compareSessions && compareSessions.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <GitCompare className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Compare Sessions
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {compareSessions.map((session) => (
                            <Card key={session.id} className="bg-card/50 border-border">
                                <CardContent className="pt-5 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold">{session.name}</p>
                                            <p className="text-xs text-muted-foreground">{session.compare_type}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px]">
                                            {session.status}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {session.completed_cases} / {session.total_cases} completed
                                    </div>
                                    <Link href={`/compare/${session.id}`}>
                                        <Button variant="outline" size="sm" className="w-full text-xs">
                                            Open Compare
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface CompareSession {
    id: string;
    name: string;
    compare_type: string;
    status: string;
    total_cases: number;
    completed_cases: number;
    failed_cases: number;
    created_at: string;
}
