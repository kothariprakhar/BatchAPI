'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase, getDeviceId } from '@/lib/supabase';
import { JobCard, type Job } from '@/components/job-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, RefreshCw, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
    const [deviceId, setDeviceId] = useState<string>('');

    useEffect(() => {
        setDeviceId(getDeviceId());
    }, []);

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

    const hasRunningJobs = jobs?.some((j) => j.status === 'running' || j.status === 'pending');

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
                            {hasRunningJobs && (
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
                        <JobCard key={job.id} job={job} />
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
        </div>
    );
}
