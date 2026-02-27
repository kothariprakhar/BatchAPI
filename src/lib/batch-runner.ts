import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { calculateSavings } from '@/lib/cost-calculator';
import { getEffectiveRpm } from '@/lib/rate-policy';
import { RateLimitedQueue } from '@/lib/rate-limited-queue';
import { classifyError, type ErrorMeta } from '@/lib/error-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GLOBAL_RATE_LIMIT_PAUSE_MS = 10_000;
const ROW_STALE_MS = 5 * 60 * 1000;
const MAX_SERVER_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 1_000;

interface BatchResultRow {
    id: string;
    compiled_prompt: string;
    retry_count: number | null;
}

interface ProcessOutcome {
    completedDelta: number;
    failedDelta: number;
    promptTokensDelta: number;
    completionTokensDelta: number;
    retryDelta: number;
}

interface StoredTokenUsage {
    promptTokens?: number;
    completionTokens?: number;
}

export interface BatchExecutionConfig {
    jobId: string;
    apiKey?: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    safetyMode?: boolean;
}

export type ScheduleResult =
    | { scheduled: true; reason: 'scheduled' }
    | { scheduled: false; reason: 'already_running' | 'missing_api_key' };

class RateLimitPauseError extends Error {
    meta: ErrorMeta;

    constructor(meta: ErrorMeta) {
        super(meta.message);
        this.meta = meta;
    }
}

class ClassifiedExecutionError extends Error {
    meta: ErrorMeta;

    constructor(meta: ErrorMeta) {
        super(meta.message);
        this.meta = meta;
    }
}

// Keep one in-flight runner per job ID.
const activeJobs = new Set<string>();

function createSupabase() {
    return createClient(supabaseUrl, supabaseAnonKey);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExecutionApiKey(config: BatchExecutionConfig): string {
    return process.env.GEMINI_API_KEY || config.apiKey || '';
}

async function updateJobProgress(
    jobId: string,
    updates: Record<string, unknown>
): Promise<void> {
    const supabase = createSupabase();
    await supabase
        .from('batch_jobs')
        .update({
            heartbeat_at: new Date().toISOString(),
            ...updates,
        })
        .eq('id', jobId);
}

async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    const supabase = createSupabase();

    await supabase
        .from('batch_jobs')
        .update({
            queue_status: 'failed',
            status: 'failed',
            completed_at: new Date().toISOString(),
            last_error: errorMessage,
            heartbeat_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    await supabase
        .from('batch_results')
        .update({
            status: 'failed',
            error: errorMessage,
            error_type: 'worker_failure',
            updated_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .in('status', ['pending', 'running']);
}

async function markJobCancelled(jobId: string): Promise<void> {
    await updateJobProgress(jobId, {
        queue_status: 'cancelled',
        status: 'cancelled',
        completed_at: new Date().toISOString(),
    });
}

async function getJobState(jobId: string): Promise<{
    completedRequests: number;
    failedRequests: number;
    retryCount: number;
    cancelRequested: boolean;
    pausedUntil: string | null;
}> {
    const supabase = createSupabase();
    const { data } = await supabase
        .from('batch_jobs')
        .select('completed_requests, failed_requests, retry_count, cancel_requested, paused_until')
        .eq('id', jobId)
        .single();

    return {
        completedRequests: data?.completed_requests ?? 0,
        failedRequests: data?.failed_requests ?? 0,
        retryCount: data?.retry_count ?? 0,
        cancelRequested: data?.cancel_requested ?? false,
        pausedUntil: data?.paused_until ?? null,
    };
}

async function sumCompletedTokenUsage(jobId: string): Promise<{
    promptTokens: number;
    completionTokens: number;
}> {
    const supabase = createSupabase();
    const { data } = await supabase
        .from('batch_results')
        .select('token_usage')
        .eq('job_id', jobId)
        .eq('status', 'completed');

    let promptTokens = 0;
    let completionTokens = 0;

    for (const row of data ?? []) {
        const usage = (row.token_usage ?? {}) as StoredTokenUsage;
        promptTokens += usage.promptTokens ?? 0;
        completionTokens += usage.completionTokens ?? 0;
    }

    return { promptTokens, completionTokens };
}

async function recoverStaleRunningRows(jobId: string): Promise<void> {
    const supabase = createSupabase();
    const staleCutoff = new Date(Date.now() - ROW_STALE_MS).toISOString();

    const { data: staleRows } = await supabase
        .from('batch_results')
        .select('id')
        .eq('job_id', jobId)
        .eq('status', 'running')
        .lt('updated_at', staleCutoff);

    if (!staleRows?.length) return;

    const staleIds = staleRows.map((row) => row.id);
    await supabase
        .from('batch_results')
        .update({
            status: 'pending',
            error: 'Recovered stale running row; re-queued for retry.',
            error_type: 'stale_recovery',
            updated_at: new Date().toISOString(),
        })
        .in('id', staleIds);
}

async function claimNextPendingRow(jobId: string): Promise<BatchResultRow | null> {
    const supabase = createSupabase();

    for (let attempt = 0; attempt < 5; attempt++) {
        const { data: candidate } = await supabase
            .from('batch_results')
            .select('id, compiled_prompt, retry_count')
            .eq('job_id', jobId)
            .eq('status', 'pending')
            .order('row_index')
            .limit(1)
            .maybeSingle();

        if (!candidate) {
            return null;
        }

        const { data: claimedRows } = await supabase
            .from('batch_results')
            .update({
                status: 'running',
                updated_at: new Date().toISOString(),
            })
            .eq('id', candidate.id)
            .eq('status', 'pending')
            .select('id, compiled_prompt, retry_count');

        if (claimedRows && claimedRows.length > 0) {
            return claimedRows[0] as BatchResultRow;
        }
    }

    return null;
}

async function applyGlobalPause(jobId: string, reason: string): Promise<void> {
    const pausedUntil = new Date(Date.now() + GLOBAL_RATE_LIMIT_PAUSE_MS).toISOString();
    await updateJobProgress(jobId, {
        queue_status: 'paused',
        paused_until: pausedUntil,
        last_error: reason,
    });
    await sleep(GLOBAL_RATE_LIMIT_PAUSE_MS);
    await updateJobProgress(jobId, {
        queue_status: 'running',
        paused_until: null,
    });
}

async function waitForExistingPauseIfNeeded(jobId: string): Promise<void> {
    const state = await getJobState(jobId);
    if (!state.pausedUntil) return;

    const pauseUntilMs = new Date(state.pausedUntil).getTime();
    const waitMs = pauseUntilMs - Date.now();
    if (waitMs > 0) {
        await updateJobProgress(jobId, { queue_status: 'paused' });
        await sleep(waitMs);
    }

    await updateJobProgress(jobId, {
        queue_status: 'running',
        paused_until: null,
    });
}

async function executeWithRetry(
    genModel: GenerativeModel,
    prompt: string,
    onRetry: (attemptNumber: number, meta: ErrorMeta, delayMs: number) => Promise<void>
): Promise<{ responseText: string; promptTokens: number; completionTokens: number; retriesUsed: number; latencyMs: number }> {
    const startTime = Date.now();

    for (let attempt = 0; attempt <= MAX_SERVER_RETRIES; attempt++) {
        try {
            const response = await genModel.generateContent(prompt);
            const usage = response.response.usageMetadata;
            return {
                responseText: response.response.text(),
                promptTokens: usage?.promptTokenCount ?? 0,
                completionTokens: usage?.candidatesTokenCount ?? 0,
                retriesUsed: attempt,
                latencyMs: Date.now() - startTime,
            };
        } catch (error: unknown) {
            const meta = classifyError(error);

            if (meta.rateLimited) {
                throw new RateLimitPauseError(meta);
            }

            if (!meta.retryable || attempt >= MAX_SERVER_RETRIES) {
                throw new ClassifiedExecutionError(meta);
            }

            const delayMs = Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, 60_000);
            const jitter = Math.floor(delayMs * 0.2 * Math.random());
            await onRetry(attempt + 1, meta, delayMs + jitter);
            await sleep(delayMs + jitter);
        }
    }

    throw new ClassifiedExecutionError(classifyError(new Error('Max retries exceeded')));
}

async function processClaimedRow(
    jobId: string,
    row: BatchResultRow,
    genModel: GenerativeModel
): Promise<ProcessOutcome> {
    const supabase = createSupabase();
    const currentRetryCount = row.retry_count ?? 0;

    try {
        const generated = await executeWithRetry(genModel, row.compiled_prompt, async (attemptNumber, _meta, delayMs) => {
            await updateJobProgress(jobId, { queue_status: 'retry_wait' });
            await supabase
                .from('batch_results')
                .update({
                    retry_count: currentRetryCount + attemptNumber,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', row.id);
            await updateJobProgress(jobId, { queue_status: 'running' });
            console.info(`[batch-runner] Job ${jobId} retrying row ${row.id} in ${delayMs}ms`);
        });

        await supabase
            .from('batch_results')
            .update({
                status: 'completed',
                output: generated.responseText,
                latency_ms: generated.latencyMs,
                retry_count: currentRetryCount + generated.retriesUsed,
                error: null,
                error_code: null,
                error_type: null,
                token_usage: {
                    promptTokens: generated.promptTokens,
                    completionTokens: generated.completionTokens,
                    totalTokens: generated.promptTokens + generated.completionTokens,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);

        return {
            completedDelta: 1,
            failedDelta: 0,
            promptTokensDelta: generated.promptTokens,
            completionTokensDelta: generated.completionTokens,
            retryDelta: generated.retriesUsed,
        };
    } catch (error: unknown) {
        if (error instanceof RateLimitPauseError) {
            await supabase
                .from('batch_results')
                .update({
                    status: 'pending',
                    error: error.meta.message,
                    error_code: error.meta.statusCode,
                    error_type: error.meta.errorType,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', row.id);

            await applyGlobalPause(jobId, `429 rate limit encountered. Queue paused for ${GLOBAL_RATE_LIMIT_PAUSE_MS / 1000}s.`);

            return {
                completedDelta: 0,
                failedDelta: 0,
                promptTokensDelta: 0,
                completionTokensDelta: 0,
                retryDelta: 0,
            };
        }

        const meta = error instanceof ClassifiedExecutionError ? error.meta : classifyError(error);
        await supabase
            .from('batch_results')
            .update({
                status: 'failed',
                error: meta.message,
                error_code: meta.statusCode,
                error_type: meta.errorType,
                updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);

        return {
            completedDelta: 0,
            failedDelta: 1,
            promptTokensDelta: 0,
            completionTokensDelta: 0,
            retryDelta: 0,
        };
    }
}

async function runBatchExecution(config: BatchExecutionConfig): Promise<void> {
    const {
        jobId,
        apiKey,
        systemPrompt,
        model,
        temperature,
        maxOutputTokens,
        safetyMode,
    } = config;

    const selectedModel = model || 'gemini-1.5-flash';
    const resolvedApiKey = process.env.GEMINI_API_KEY || apiKey;
    if (!resolvedApiKey) {
        throw new Error('No Gemini API key configured. Set GEMINI_API_KEY or provide apiKey.');
    }

    const initialState = await getJobState(jobId);
    let completedCount = initialState.completedRequests;
    let failedCount = initialState.failedRequests;
    let totalRetries = initialState.retryCount;

    const existingTokens = await sumCompletedTokenUsage(jobId);
    let totalPromptTokens = existingTokens.promptTokens;
    let totalCompletionTokens = existingTokens.completionTokens;

    await updateJobProgress(jobId, {
        queue_status: 'running',
        status: 'running',
        started_at: new Date().toISOString(),
    });

    const rpmLimit = getEffectiveRpm(selectedModel, Boolean(safetyMode));
    const queue = new RateLimitedQueue({
        concurrency: 1,
        intervalCap: rpmLimit,
        intervalMs: 60 * 1000,
    });

    const genAI = new GoogleGenerativeAI(resolvedApiKey);
    const genModel = genAI.getGenerativeModel({
        model: selectedModel,
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        generationConfig: {
            temperature: temperature ?? 0.7,
            maxOutputTokens: maxOutputTokens ?? 1024,
        },
    });

    while (true) {
        await waitForExistingPauseIfNeeded(jobId);

        const latestState = await getJobState(jobId);
        if (latestState.cancelRequested) {
            await markJobCancelled(jobId);
            return;
        }

        await recoverStaleRunningRows(jobId);
        const claimedRow = await claimNextPendingRow(jobId);

        if (!claimedRow) {
            break;
        }

        let outcome: ProcessOutcome = {
            completedDelta: 0,
            failedDelta: 0,
            promptTokensDelta: 0,
            completionTokensDelta: 0,
            retryDelta: 0,
        };
        await queue.add(async () => {
            outcome = await processClaimedRow(jobId, claimedRow, genModel);
        });
        completedCount += outcome.completedDelta;
        failedCount += outcome.failedDelta;
        totalPromptTokens += outcome.promptTokensDelta;
        totalCompletionTokens += outcome.completionTokensDelta;
        totalRetries += outcome.retryDelta;

        await updateJobProgress(jobId, {
            queue_status: 'running',
            completed_requests: completedCount,
            failed_requests: failedCount,
            retry_count: totalRetries,
        });
    }

    await queue.onIdle();

    const savings = calculateSavings(selectedModel, totalPromptTokens, totalCompletionTokens);

    const finalStatus = completedCount === 0 && failedCount > 0 ? 'failed' : 'completed';
    await updateJobProgress(jobId, {
        queue_status: finalStatus,
        status: finalStatus,
        completed_at: new Date().toISOString(),
        estimated_savings_usd: savings.savingsUsd,
        retry_count: totalRetries,
    });

    console.info('[batch-runner] Job complete', {
        jobId,
        model: selectedModel,
        completedCount,
        failedCount,
        totalRetries,
        savingsUsd: savings.savingsUsd,
    });
}

export function scheduleBatchExecution(config: BatchExecutionConfig): ScheduleResult {
    if (activeJobs.has(config.jobId)) {
        return { scheduled: false, reason: 'already_running' };
    }

    if (!getExecutionApiKey(config)) {
        return { scheduled: false, reason: 'missing_api_key' };
    }

    activeJobs.add(config.jobId);

    void (async () => {
        try {
            await runBatchExecution(config);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown worker error';
            await markJobFailed(config.jobId, message);
            console.error(`[batch-runner] Job ${config.jobId} failed:`, error);
        } finally {
            activeJobs.delete(config.jobId);
        }
    })();

    return { scheduled: true, reason: 'scheduled' };
}
