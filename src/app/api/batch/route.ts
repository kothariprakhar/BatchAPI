import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scheduleBatchExecution } from '@/lib/batch-runner';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { jobId, apiKey, systemPrompt, model, temperature, maxOutputTokens, safetyMode } = body;

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    await supabase
        .from('batch_jobs')
        .update({
            queue_status: 'queued',
            status: 'pending',
            completed_at: null,
            last_error: null,
            paused_until: null,
            cancel_requested: false,
        })
        .eq('id', jobId);

    const schedule = scheduleBatchExecution({
        jobId,
        apiKey,
        systemPrompt,
        model,
        temperature,
        maxOutputTokens,
        safetyMode,
    });

    if (!schedule.scheduled && schedule.reason === 'missing_api_key') {
        return NextResponse.json(
            {
                accepted: false,
                scheduled: false,
                error:
                    'No API key available. Configure GEMINI_API_KEY on the server or provide a client API key.',
            },
            { status: 400 }
        );
    }

    return NextResponse.json(
        {
            accepted: true,
            scheduled: schedule.scheduled,
            message: schedule.scheduled
                ? 'Batch job accepted and queued for background execution.'
                : 'Batch job is already running in this worker process.',
        },
        { status: 202 }
    );
}
