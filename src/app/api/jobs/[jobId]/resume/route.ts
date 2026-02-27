import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scheduleBatchExecution } from '@/lib/batch-runner';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;
    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const apiKey = body?.apiKey as string | undefined;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: job, error: jobError } = await supabase
        .from('batch_jobs')
        .select('template_id, model, generation_config, safety_mode')
        .eq('id', jobId)
        .single();

    if (jobError || !job) {
        return NextResponse.json(
            { error: jobError?.message ?? 'Job not found' },
            { status: 404 }
        );
    }

    let systemPrompt = '';
    if (job.template_id) {
        const { data: template } = await supabase
            .from('prompt_templates')
            .select('system_prompt')
            .eq('id', job.template_id)
            .single();
        systemPrompt = template?.system_prompt ?? '';
    }

    await supabase
        .from('batch_results')
        .update({
            status: 'pending',
            updated_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .eq('status', 'running');

    await supabase
        .from('batch_jobs')
        .update({
            cancel_requested: false,
            queue_status: 'queued',
            status: 'pending',
            paused_until: null,
            completed_at: null,
            last_error: null,
            heartbeat_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    const schedule = scheduleBatchExecution({
        jobId,
        apiKey,
        systemPrompt,
        model: job.model,
        temperature: job.generation_config?.temperature,
        maxOutputTokens: job.generation_config?.maxOutputTokens,
        safetyMode: job.safety_mode ?? false,
    });

    if (!schedule.scheduled && schedule.reason === 'missing_api_key') {
        return NextResponse.json(
            {
                ok: false,
                error: 'No API key available. Configure GEMINI_API_KEY on the server or provide a client API key.',
            },
            { status: 400 }
        );
    }

    return NextResponse.json({ ok: true, scheduled: schedule.scheduled, reason: schedule.reason });
}
