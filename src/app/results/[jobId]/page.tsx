'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatUsd } from '@/lib/cost-calculator';
import { exportToCsv, exportToJson } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Copy,
    FileJson2,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    BarChart3,
    DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

interface BatchResult {
    id: string;
    job_id: string;
    row_index: number;
    input_variables: Record<string, string>;
    compiled_prompt: string;
    output: string | null;
    token_usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    latency_ms: number | null;
    status: string;
    error: string | null;
}

interface BatchJob {
    id: string;
    name: string;
    status: string;
    total_requests: number;
    completed_requests: number;
    failed_requests: number;
    model: string;
    estimated_savings_usd: number;
    created_at: string;
}

export default function ResultsPage() {
    const params = useParams();
    const jobId = params.jobId as string;
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Fetch job details
    const { data: job } = useQuery({
        queryKey: ['job', jobId],
        queryFn: async (): Promise<BatchJob | null> => {
            const { data } = await supabase
                .from('batch_jobs')
                .select('*')
                .eq('id', jobId)
                .single();
            return data as BatchJob | null;
        },
    });

    // Fetch results
    const { data: results, isLoading } = useQuery({
        queryKey: ['results', jobId],
        queryFn: async (): Promise<BatchResult[]> => {
            const { data, error } = await supabase
                .from('batch_results')
                .select('*')
                .eq('job_id', jobId)
                .order('row_index');
            if (error) throw error;
            return (data as BatchResult[]) ?? [];
        },
    });

    // Computed metrics
    const metrics = useMemo(() => {
        if (!results || results.length === 0) return null;

        const completed = results.filter((r) => r.status === 'completed');
        const latencies = completed.map((r) => r.latency_ms ?? 0).filter((l) => l > 0);
        const totalTokens = completed.reduce(
            (sum, r) => sum + (r.token_usage?.totalTokens ?? 0),
            0
        );

        return {
            successRate: results.length > 0 ? (completed.length / results.length) * 100 : 0,
            avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
            totalTokens,
            totalResults: results.length,
        };
    }, [results]);

    const currentResult = results?.[selectedIndex];

    // Export handlers
    const handleExportCsv = () => {
        if (!results || !job) return;
        const exportData = results.map((r) => ({
            row: r.row_index + 1,
            input_variables: r.input_variables,
            compiled_prompt: r.compiled_prompt,
            output: r.output,
            status: r.status,
            latency_ms: r.latency_ms,
            prompt_tokens: r.token_usage?.promptTokens ?? 0,
            completion_tokens: r.token_usage?.completionTokens ?? 0,
            total_tokens: r.token_usage?.totalTokens ?? 0,
            error: r.error,
        }));
        exportToCsv(exportData, job.name);
    };

    const handleExportJson = () => {
        if (!results || !job) return;
        const exportData = results.map((r) => ({
            row: r.row_index + 1,
            input_variables: r.input_variables,
            compiled_prompt: r.compiled_prompt,
            output: r.output,
            status: r.status,
            latency_ms: r.latency_ms,
            prompt_tokens: r.token_usage?.promptTokens ?? 0,
            completion_tokens: r.token_usage?.completionTokens ?? 0,
            total_tokens: r.token_usage?.totalTokens ?? 0,
            error: r.error,
        }));
        exportToJson(exportData, job.name);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-96 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{job?.name ?? 'Results'}</h1>
                        <p className="text-sm text-muted-foreground">
                            {job?.model} • {results?.length ?? 0} results
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-2">
                        <FileJson2 className="h-3.5 w-3.5" />
                        JSON
                    </Button>
                </div>
            </div>

            {/* Metrics Cards */}
            {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                        icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        label="Success Rate"
                        value={`${metrics.successRate.toFixed(0)}%`}
                        color="emerald"
                    />
                    <MetricCard
                        icon={<Clock className="h-4 w-4 text-blue-400" />}
                        label="Avg Latency"
                        value={`${(metrics.avgLatency / 1000).toFixed(1)}s`}
                        color="blue"
                    />
                    <MetricCard
                        icon={<Zap className="h-4 w-4 text-amber-400" />}
                        label="Total Tokens"
                        value={metrics.totalTokens.toLocaleString()}
                        color="amber"
                    />
                    <MetricCard
                        icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
                        label="Batch Savings"
                        value={formatUsd(job?.estimated_savings_usd ?? 0)}
                        color="emerald"
                    />
                </div>
            )}

            {/* Result Navigator */}
            {results && results.length > 0 && (
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                        disabled={selectedIndex === 0}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Select
                        value={String(selectedIndex)}
                        onValueChange={(v) => setSelectedIndex(parseInt(v))}
                    >
                        <SelectTrigger className="w-[180px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {results.map((r, i) => (
                                <SelectItem key={r.id} value={String(i)}>
                                    <div className="flex items-center gap-2">
                                        {r.status === 'completed' ? (
                                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                        ) : (
                                            <XCircle className="h-3 w-3 text-red-400" />
                                        )}
                                        Result {i + 1}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedIndex(Math.min(results.length - 1, selectedIndex + 1))}
                        disabled={selectedIndex === results.length - 1}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>

                    <span className="text-xs text-muted-foreground">
                        {selectedIndex + 1} of {results.length}
                    </span>

                    {currentResult?.latency_ms && (
                        <>
                            <Separator orientation="vertical" className="h-4" />
                            <Badge variant="secondary" className="text-[10px]">
                                {(currentResult.latency_ms / 1000).toFixed(1)}s
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                                {currentResult.token_usage?.totalTokens ?? 0} tokens
                            </Badge>
                        </>
                    )}
                </div>
            )}

            {/* Split View */}
            {currentResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[400px]">
                    {/* Left: Input */}
                    <Card className="bg-card/50 flex flex-col">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Input Prompt</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => navigator.clipboard.writeText(currentResult.compiled_prompt)}
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                        <CardContent className="flex-1 p-0">
                            <ScrollArea className="h-full max-h-[500px]">
                                <div className="p-5 space-y-4">
                                    {/* Variable pills */}
                                    {Object.entries(currentResult.input_variables).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(currentResult.input_variables).map(([key, value]) => (
                                                <span
                                                    key={key}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                                >
                                                    <span className="font-mono opacity-60">{key}:</span>
                                                    <span className="font-medium">{String(value).slice(0, 30)}{String(value).length > 30 ? '...' : ''}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/80">
                                        {currentResult.compiled_prompt}
                                    </pre>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Right: Output */}
                    <Card className={cn(
                        'flex flex-col',
                        currentResult.status === 'completed'
                            ? 'bg-card/50'
                            : 'bg-red-500/5 border-red-500/20'
                    )}>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                            <div className="flex items-center gap-2">
                                {currentResult.status === 'completed' ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-sm font-medium">
                                    {currentResult.status === 'completed' ? 'Gemini Output' : 'Error'}
                                </span>
                            </div>
                            {currentResult.output && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => navigator.clipboard.writeText(currentResult.output ?? '')}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        <CardContent className="flex-1 p-0">
                            <ScrollArea className="h-full max-h-[500px]">
                                <div className="p-5">
                                    {currentResult.status === 'completed' ? (
                                        <div className="text-sm whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                                            {currentResult.output}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-red-400">
                                            {currentResult.error ?? 'Unknown error occurred'}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function MetricCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <Card className={cn('bg-card/50 border', `border-${color}-500/10`)}>
            <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-2">
                    {icon}
                    <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}
