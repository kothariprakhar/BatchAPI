import { NextRequest, NextResponse } from 'next/server';
import { scheduleBatchExecution } from '@/lib/batch-runner';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { jobId, apiKey, systemPrompt, model, temperature, maxOutputTokens, safetyMode } = body;

    if (!jobId || !apiKey) {
        return NextResponse.json({ error: 'Missing jobId or apiKey' }, { status: 400 });
    }

    const scheduled = scheduleBatchExecution({
        jobId,
        apiKey,
        systemPrompt,
        model,
        temperature,
        maxOutputTokens,
        safetyMode,
    });

    return NextResponse.json(
        {
            accepted: true,
            scheduled,
            message: scheduled
                ? 'Batch job accepted and queued for background execution.'
                : 'Batch job is already running in this worker process.',
        },
        { status: 202 }
    );
}
