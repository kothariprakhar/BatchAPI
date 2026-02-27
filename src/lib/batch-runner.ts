import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculateSavings } from '@/lib/cost-calculator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface BatchResultRow {
    id: string;
    compiled_prompt: string;
}

export interface BatchExecutionConfig {
    jobId: string;
    apiKey: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    safetyMode?: boolean;
}

// Keep one in-flight runner per job ID.
const activeJobs = new Set<string>();

class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillRateMs: number;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.lastRefill = Date.now();
        this.refillRateMs = (60 * 1000) / capacity;
    }

    async acquire(): Promise<void> {
        this.refill();
        while (this.tokens < 1) {
            const waitMs = this.refillRateMs - (Date.now() - this.lastRefill);
            await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 100)));
            this.refill();
        }
        this.tokens -= 1;
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const newTokens = elapsed / this.refillRateMs;
        this.tokens = Math.min(this.capacity, this.tokens + newTokens);
        this.lastRefill = now;
    }
}

async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 4,
    baseDelayMs = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const message = lastError.message;

            if (!message.includes('429') && !message.includes('500') && !message.includes('503')) {
                throw lastError;
            }

            if (attempt < maxRetries) {
                const delay = Math.min(baseDelayMs * 2 ** attempt, 60000);
                const jitter = delay * 0.2 * Math.random();
                await new Promise((resolve) => setTimeout(resolve, delay + jitter));
            }
        }
    }

    throw lastError ?? new Error('Max retries exceeded');
}

async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    await supabase
        .from('batch_jobs')
        .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    await supabase
        .from('batch_results')
        .update({
            status: 'failed',
            error: errorMessage,
        })
        .eq('job_id', jobId)
        .in('status', ['pending', 'running']);
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: results, error: fetchError } = await supabase
        .from('batch_results')
        .select('id, compiled_prompt')
        .eq('job_id', jobId)
        .eq('status', 'pending')
        .order('row_index');

    if (fetchError || !results) {
        throw new Error(fetchError?.message ?? 'Failed to fetch pending batch results');
    }

    await supabase
        .from('batch_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', jobId);

    if (results.length === 0) {
        await supabase
            .from('batch_jobs')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', jobId);
        return;
    }

    const rpmLimit = safetyMode ? 10 : 15;
    const bucket = new TokenBucket(rpmLimit);

    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({
        model: model || 'gemini-1.5-flash',
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        generationConfig: {
            temperature: temperature ?? 0.7,
            maxOutputTokens: maxOutputTokens ?? 1024,
        },
    });

    let completedCount = 0;
    let failedCount = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const result of results as BatchResultRow[]) {
        await bucket.acquire();

        await supabase.from('batch_results').update({ status: 'running' }).eq('id', result.id);

        const startTime = Date.now();

        try {
            const response = await withRetry(async () => genModel.generateContent(result.compiled_prompt));

            const latencyMs = Date.now() - startTime;
            const text = response.response.text();
            const usage = response.response.usageMetadata;

            const promptTokens = usage?.promptTokenCount ?? 0;
            const completionTokens = usage?.candidatesTokenCount ?? 0;

            totalPromptTokens += promptTokens;
            totalCompletionTokens += completionTokens;

            await supabase
                .from('batch_results')
                .update({
                    status: 'completed',
                    output: text,
                    latency_ms: latencyMs,
                    token_usage: {
                        promptTokens,
                        completionTokens,
                        totalTokens: usage?.totalTokenCount ?? 0,
                    },
                })
                .eq('id', result.id);

            completedCount++;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await supabase
                .from('batch_results')
                .update({ status: 'failed', error: message })
                .eq('id', result.id);
            failedCount++;
        }

        await supabase
            .from('batch_jobs')
            .update({
                completed_requests: completedCount,
                failed_requests: failedCount,
            })
            .eq('id', jobId);
    }

    const savings = calculateSavings(
        model || 'gemini-1.5-flash',
        totalPromptTokens,
        totalCompletionTokens
    );

    const finalStatus = failedCount === results.length ? 'failed' : 'completed';

    await supabase
        .from('batch_jobs')
        .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            estimated_savings_usd: savings.savingsUsd,
        })
        .eq('id', jobId);
}

export function scheduleBatchExecution(config: BatchExecutionConfig): boolean {
    if (activeJobs.has(config.jobId)) {
        return false;
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

    return true;
}
