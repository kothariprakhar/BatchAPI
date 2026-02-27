import { createClient } from '@supabase/supabase-js';
import {
    computeDiffSummary,
    computeFlags,
    deriveCompareSessionStatus,
    type CompareDiffSummary,
    type CompareFlags,
} from '@/lib/compare';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface ComparePairRow {
    compareCaseId: string;
    rowIndex: number;
    inputVariables: Record<string, string>;
    leftPrompt: string;
    rightPrompt: string;
    leftResultId: string | null;
    rightResultId: string | null;
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
    diffSummary: CompareDiffSummary;
    flags: CompareFlags;
    pairStatus: 'pending' | 'completed' | 'failed';
}

function buildSupabase() {
    return createClient(supabaseUrl, supabaseAnonKey);
}

function getTotalTokens(tokenUsage: unknown): number {
    if (!tokenUsage || typeof tokenUsage !== 'object') return 0;
    const usage = tokenUsage as { totalTokens?: number };
    return usage.totalTokens ?? 0;
}

function resolvePairStatus(leftStatus: string | null, rightStatus: string | null): 'pending' | 'completed' | 'failed' {
    if (leftStatus === 'failed' || rightStatus === 'failed') return 'failed';
    if (leftStatus === 'completed' && rightStatus === 'completed') return 'completed';
    return 'pending';
}

export async function buildComparePairs(compareId: string): Promise<ComparePairRow[]> {
    const supabase = buildSupabase();

    const { data: cases } = await supabase
        .from('compare_cases')
        .select('id, row_index, input_variables, compiled_left_prompt, compiled_right_prompt')
        .eq('compare_session_id', compareId)
        .order('row_index');

    if (!cases?.length) return [];

    const compareCaseIds = cases.map((entry) => entry.id);
    const { data: compareResults } = await supabase
        .from('compare_results')
        .select('id, compare_case_id, left_result_id, right_result_id')
        .in('compare_case_id', compareCaseIds);

    const compareByCase = new Map(
        (compareResults ?? []).map((entry) => [entry.compare_case_id, entry])
    );

    const resultIds = new Set<string>();
    for (const entry of compareResults ?? []) {
        if (entry.left_result_id) resultIds.add(entry.left_result_id);
        if (entry.right_result_id) resultIds.add(entry.right_result_id);
    }

    const { data: rawBatchResults } =
        resultIds.size > 0
            ? await supabase
                  .from('batch_results')
                  .select('id, status, output, error, latency_ms, token_usage')
                  .in('id', Array.from(resultIds))
            : { data: [] as Array<Record<string, unknown>> };

    const batchById = new Map((rawBatchResults ?? []).map((entry) => [entry.id as string, entry]));

    const pairs: ComparePairRow[] = [];
    for (const row of cases) {
        const pairRef = compareByCase.get(row.id);
        const left = pairRef?.left_result_id ? batchById.get(pairRef.left_result_id) : null;
        const right = pairRef?.right_result_id ? batchById.get(pairRef.right_result_id) : null;

        const leftStatus = (left?.status as string | undefined) ?? null;
        const rightStatus = (right?.status as string | undefined) ?? null;
        const leftOutput = (left?.output as string | undefined) ?? null;
        const rightOutput = (right?.output as string | undefined) ?? null;

        const diffSummary = computeDiffSummary(leftOutput, rightOutput);
        const flags = computeFlags(leftOutput, rightOutput);
        const pairStatus = resolvePairStatus(leftStatus, rightStatus);

        pairs.push({
            compareCaseId: row.id,
            rowIndex: row.row_index,
            inputVariables: row.input_variables as Record<string, string>,
            leftPrompt: row.compiled_left_prompt,
            rightPrompt: row.compiled_right_prompt,
            leftResultId: pairRef?.left_result_id ?? null,
            rightResultId: pairRef?.right_result_id ?? null,
            leftStatus,
            rightStatus,
            leftOutput,
            rightOutput,
            leftError: (left?.error as string | undefined) ?? null,
            rightError: (right?.error as string | undefined) ?? null,
            leftLatencyMs: (left?.latency_ms as number | undefined) ?? null,
            rightLatencyMs: (right?.latency_ms as number | undefined) ?? null,
            leftTokens: getTotalTokens(left?.token_usage),
            rightTokens: getTotalTokens(right?.token_usage),
            diffSummary,
            flags,
            pairStatus,
        });
    }

    return pairs;
}

export async function syncCompareSession(compareId: string): Promise<{
    status: string;
    totalCases: number;
    completedCases: number;
    failedCases: number;
}> {
    const supabase = buildSupabase();

    const { data: compareSession } = await supabase
        .from('compare_sessions')
        .select('id, left_job_id, right_job_id, status')
        .eq('id', compareId)
        .single();

    if (!compareSession) {
        return { status: 'failed', totalCases: 0, completedCases: 0, failedCases: 0 };
    }

    const pairs = await buildComparePairs(compareId);

    const compareResultUpdates = pairs
        .filter((row) => row.leftResultId && row.rightResultId)
        .map((row) => ({
            compare_case_id: row.compareCaseId,
            left_result_id: row.leftResultId,
            right_result_id: row.rightResultId,
            status: row.pairStatus,
            diff_summary: row.diffSummary,
            flags_json: row.flags,
            updated_at: new Date().toISOString(),
        }));

    if (compareResultUpdates.length > 0) {
        await supabase
            .from('compare_results')
            .upsert(compareResultUpdates, { onConflict: 'compare_case_id' });
    }

    const totalCases = pairs.length;
    const completedCases = pairs.filter((row) => row.pairStatus === 'completed').length;
    const failedCases = pairs.filter((row) => row.pairStatus === 'failed').length;

    const jobIds = [compareSession.left_job_id, compareSession.right_job_id].filter(Boolean);
    const { data: jobs } =
        jobIds.length > 0
            ? await supabase
                  .from('batch_jobs')
                  .select('id, queue_status, status')
                  .in('id', jobIds as string[])
            : { data: [] as Array<Record<string, unknown>> };

    const effectiveStatuses = (jobs ?? []).map(
        (job) => (job.queue_status as string | null) ?? (job.status as string | null) ?? 'queued'
    );

    const derivedStatus = deriveCompareSessionStatus({
        jobStatuses: effectiveStatuses,
        totalCases,
        completedCases,
        failedCases,
        previousStatus: compareSession.status as string,
    });

    await supabase
        .from('compare_sessions')
        .update({
            status: derivedStatus,
            total_cases: totalCases,
            completed_cases: completedCases,
            failed_cases: failedCases,
            completed_at: ['completed', 'partial_failed', 'failed', 'cancelled'].includes(
                derivedStatus
            )
                ? new Date().toISOString()
                : null,
        })
        .eq('id', compareId);

    return {
        status: derivedStatus,
        totalCases,
        completedCases,
        failedCases,
    };
}
