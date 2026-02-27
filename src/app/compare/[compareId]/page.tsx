'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { exportCompareToCsv, exportCompareToJson } from '@/lib/export';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    GitCompare,
    Filter,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    FileJson2,
    FileSpreadsheet,
} from 'lucide-react';

interface ComparePair {
    compareCaseId: string;
    rowIndex: number;
    inputVariables: Record<string, string>;
    leftPrompt: string;
    rightPrompt: string;
    leftStatus: string | null;
    rightStatus: string | null;
    leftOutput: string | null;
    rightOutput: string | null;
    leftError: string | null;
    rightError: string | null;
    leftLatencyMs: number | null;
    rightLatencyMs: number | null;
    leftTokens: number;
    rightTokens: number;
    diffSummary: {
        changed: boolean;
        leftLength: number;
        rightLength: number;
        lengthDelta: number;
        firstDifferenceAt: number;
    };
    flags: {
        formattingShift: boolean;
        possibleHallucinationShift: boolean;
        majorLengthShift: boolean;
    };
    pairStatus: 'pending' | 'completed' | 'failed';
}

interface CompareSummary {
    id: string;
    name: string;
    status: string;
    compare_type: string;
    total_cases: number;
    completed_cases: number;
    failed_cases: number;
}

export default function CompareResultsPage() {
    const params = useParams();
    const compareId = params.compareId as string;

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [changedOnly, setChangedOnly] = useState(false);
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [failedOnly, setFailedOnly] = useState(false);

    const summaryQuery = useQuery({
        queryKey: ['compare-summary', compareId],
        queryFn: async (): Promise<CompareSummary> => {
            const response = await fetch(`/api/compare/${compareId}`);
            if (!response.ok) throw new Error('Failed to load compare session');
            return response.json();
        },
    });

    const pairsQuery = useQuery({
        queryKey: ['compare-pairs', compareId],
        queryFn: async (): Promise<ComparePair[]> => {
            const response = await fetch(`/api/compare/${compareId}/results`);
            if (!response.ok) throw new Error('Failed to load compare results');
            const payload = await response.json();
            return payload.pairs as ComparePair[];
        },
    });

    useEffect(() => {
        if (!compareId) return;
        const source = new EventSource(`/api/compare/${compareId}/events`);
        source.onmessage = () => {
            void summaryQuery.refetch();
            void pairsQuery.refetch();
        };
        source.onerror = () => source.close();
        return () => source.close();
    }, [compareId, summaryQuery, pairsQuery]);

    const filteredPairs = useMemo(() => {
        return (pairsQuery.data ?? []).filter((pair) => {
            if (changedOnly && !pair.diffSummary.changed) return false;
            if (flaggedOnly && !Object.values(pair.flags).some(Boolean)) return false;
            if (failedOnly && pair.pairStatus !== 'failed') return false;
            return true;
        });
    }, [pairsQuery.data, changedOnly, flaggedOnly, failedOnly]);

    const safeSelectedIndex =
        filteredPairs.length === 0
            ? 0
            : Math.min(selectedIndex, filteredPairs.length - 1);
    const currentPair = filteredPairs[safeSelectedIndex] ?? null;

    const handleExportCsv = () => {
        if (!pairsQuery.data || pairsQuery.data.length === 0) return;
        const exportRows = pairsQuery.data.map((pair) => ({
            row: pair.rowIndex + 1,
            input_variables: pair.inputVariables,
            left_prompt: pair.leftPrompt,
            right_prompt: pair.rightPrompt,
            left_output: pair.leftOutput,
            right_output: pair.rightOutput,
            left_status: pair.leftStatus,
            right_status: pair.rightStatus,
            left_latency_ms: pair.leftLatencyMs,
            right_latency_ms: pair.rightLatencyMs,
            left_tokens: pair.leftTokens,
            right_tokens: pair.rightTokens,
            pair_status: pair.pairStatus,
            changed: pair.diffSummary.changed,
            length_delta: pair.diffSummary.lengthDelta,
            first_difference_at: pair.diffSummary.firstDifferenceAt,
            formatting_shift: pair.flags.formattingShift,
            possible_hallucination_shift: pair.flags.possibleHallucinationShift,
            major_length_shift: pair.flags.majorLengthShift,
        }));
        exportCompareToCsv(
            exportRows,
            (summaryQuery.data?.name ?? `compare-${compareId}`).replace(/\s+/g, '-')
        );
    };

    const handleExportJson = () => {
        if (!pairsQuery.data || pairsQuery.data.length === 0) return;
        const exportRows = pairsQuery.data.map((pair) => ({
            row: pair.rowIndex + 1,
            input_variables: pair.inputVariables,
            left_prompt: pair.leftPrompt,
            right_prompt: pair.rightPrompt,
            left_output: pair.leftOutput,
            right_output: pair.rightOutput,
            left_status: pair.leftStatus,
            right_status: pair.rightStatus,
            left_latency_ms: pair.leftLatencyMs,
            right_latency_ms: pair.rightLatencyMs,
            left_tokens: pair.leftTokens,
            right_tokens: pair.rightTokens,
            pair_status: pair.pairStatus,
            changed: pair.diffSummary.changed,
            length_delta: pair.diffSummary.lengthDelta,
            first_difference_at: pair.diffSummary.firstDifferenceAt,
            formatting_shift: pair.flags.formattingShift,
            possible_hallucination_shift: pair.flags.possibleHallucinationShift,
            major_length_shift: pair.flags.majorLengthShift,
        }));
        exportCompareToJson(
            exportRows,
            (summaryQuery.data?.name ?? `compare-${compareId}`).replace(/\s+/g, '-')
        );
    };

    if (summaryQuery.isLoading || pairsQuery.isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-96 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{summaryQuery.data?.name ?? 'Compare Results'}</h1>
                        <p className="text-sm text-muted-foreground">
                            {summaryQuery.data?.compare_type} • {summaryQuery.data?.status}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        CSV
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleExportJson}>
                        <FileJson2 className="h-3.5 w-3.5" />
                        JSON
                    </Button>
                    <Badge variant="outline" className="gap-2">
                        <GitCompare className="h-3.5 w-3.5" />
                        {summaryQuery.data?.completed_cases ?? 0}/{summaryQuery.data?.total_cases ?? 0} done
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Metric label="Completed" value={String(summaryQuery.data?.completed_cases ?? 0)} />
                <Metric label="Failed" value={String(summaryQuery.data?.failed_cases ?? 0)} />
                <Metric
                    label="Changed"
                    value={String((pairsQuery.data ?? []).filter((pair) => pair.diffSummary.changed).length)}
                />
            </div>

            <Card className="bg-card/50">
                <CardContent className="pt-4 flex flex-wrap gap-2 items-center">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Button variant={changedOnly ? 'default' : 'outline'} size="sm" onClick={() => setChangedOnly((prev) => !prev)}>
                        Changed only
                    </Button>
                    <Button variant={flaggedOnly ? 'default' : 'outline'} size="sm" onClick={() => setFlaggedOnly((prev) => !prev)}>
                        Flagged only
                    </Button>
                    <Button variant={failedOnly ? 'default' : 'outline'} size="sm" onClick={() => setFailedOnly((prev) => !prev)}>
                        Failed only
                    </Button>
                </CardContent>
            </Card>

            {filteredPairs.length > 0 && (
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedIndex((prev) => Math.max(prev - 1, 0))}
                        disabled={safeSelectedIndex === 0}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Select value={String(safeSelectedIndex)} onValueChange={(value) => setSelectedIndex(parseInt(value, 10))}>
                        <SelectTrigger className="w-[220px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredPairs.map((pair, index) => (
                                <SelectItem key={pair.compareCaseId} value={String(index)}>
                                    Case {pair.rowIndex + 1} {pair.pairStatus === 'failed' ? '• failed' : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedIndex((prev) => Math.min(prev + 1, filteredPairs.length - 1))}
                        disabled={safeSelectedIndex === filteredPairs.length - 1}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>

                    <span className="text-xs text-muted-foreground">
                        {safeSelectedIndex + 1} of {filteredPairs.length}
                    </span>
                </div>
            )}

            {currentPair ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <ComparePanel
                        title="Left"
                        prompt={currentPair.leftPrompt}
                        output={currentPair.leftOutput}
                        error={currentPair.leftError}
                        status={currentPair.leftStatus}
                        latencyMs={currentPair.leftLatencyMs}
                        tokens={currentPair.leftTokens}
                    />
                    <ComparePanel
                        title="Right"
                        prompt={currentPair.rightPrompt}
                        output={currentPair.rightOutput}
                        error={currentPair.rightError}
                        status={currentPair.rightStatus}
                        latencyMs={currentPair.rightLatencyMs}
                        tokens={currentPair.rightTokens}
                    />

                    <Card className="xl:col-span-2 bg-card/50">
                        <CardContent className="pt-5 space-y-3">
                            <h3 className="text-sm font-medium">Diff Summary</h3>
                            <div className="flex gap-2 flex-wrap">
                                <Badge variant={currentPair.diffSummary.changed ? 'default' : 'secondary'}>
                                    {currentPair.diffSummary.changed ? 'Output changed' : 'No change'}
                                </Badge>
                                <Badge variant="outline">Length delta: {currentPair.diffSummary.lengthDelta}</Badge>
                                <Badge variant="outline">First diff at: {currentPair.diffSummary.firstDifferenceAt}</Badge>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {currentPair.flags.formattingShift && (
                                    <Badge variant="outline" className="text-amber-500 border-amber-500/20">Formatting shift</Badge>
                                )}
                                {currentPair.flags.possibleHallucinationShift && (
                                    <Badge variant="outline" className="text-amber-500 border-amber-500/20">Possible hallucination shift</Badge>
                                )}
                                {currentPair.flags.majorLengthShift && (
                                    <Badge variant="outline" className="text-amber-500 border-amber-500/20">Major length shift</Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                        No cases match current filters.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <Card className="bg-card/50">
            <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}

function ComparePanel({
    title,
    prompt,
    output,
    error,
    status,
    latencyMs,
    tokens,
}: {
    title: string;
    prompt: string;
    output: string | null;
    error: string | null;
    status: string | null;
    latencyMs: number | null;
    tokens: number;
}) {
    const success = status === 'completed';

    return (
        <Card className="bg-card/50 flex flex-col min-h-[420px]">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                    <span className="text-sm font-medium">{title}</span>
                    <Badge variant="secondary" className="text-[10px]">{status ?? 'pending'}</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground">
                    {latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '—'} • {tokens} tokens
                </div>
            </div>

            <CardContent className="p-0 grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0">
                <div className="border-r border-border/50">
                    <div className="px-4 py-2 text-[11px] uppercase text-muted-foreground">Prompt</div>
                    <ScrollArea className="h-[320px]">
                        <pre className="text-xs whitespace-pre-wrap break-words p-4">{prompt}</pre>
                    </ScrollArea>
                </div>
                <div>
                    <div className="px-4 py-2 text-[11px] uppercase text-muted-foreground">Output</div>
                    <ScrollArea className="h-[320px]">
                        {success ? (
                            <div className="text-sm whitespace-pre-wrap break-words p-4">{output}</div>
                        ) : (
                            <div className="text-sm text-red-400 p-4">{error ?? 'No output yet'}</div>
                        )}
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
}
