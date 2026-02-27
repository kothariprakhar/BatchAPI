import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scheduleBatchExecution } from '@/lib/batch-runner';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ compareId: string }> }
) {
    const { compareId } = await params;
    if (!compareId) {
        return NextResponse.json({ error: 'Missing compareId' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const apiKey = body?.apiKey as string | undefined;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: session } = await supabase
        .from('compare_sessions')
        .select('left_job_id, right_job_id')
        .eq('id', compareId)
        .single();

    if (!session) {
        return NextResponse.json({ error: 'Compare session not found' }, { status: 404 });
    }

    const jobIds = [session.left_job_id, session.right_job_id].filter(Boolean) as string[];
    const { data: jobs } = await supabase
        .from('batch_jobs')
        .select('id, template_id, model, generation_config, safety_mode')
        .in('id', jobIds);

    if (!jobs?.length) {
        return NextResponse.json({ error: 'No jobs found for compare session' }, { status: 404 });
    }

    const templateIds = jobs.map((job) => job.template_id).filter(Boolean) as string[];
    const { data: templates } =
        templateIds.length > 0
            ? await supabase
                  .from('prompt_templates')
                  .select('id, system_prompt')
                  .in('id', templateIds)
            : { data: [] as Array<{ id: string; system_prompt: string }> };

    const systemByTemplate = new Map((templates ?? []).map((template) => [template.id, template.system_prompt]));

    await supabase
        .from('batch_results')
        .update({
            status: 'pending',
            updated_at: new Date().toISOString(),
        })
        .in('job_id', jobIds)
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
        .in('id', jobIds);

    const scheduleResults = jobs.map((job) =>
        scheduleBatchExecution({
            jobId: job.id,
            apiKey,
            systemPrompt: systemByTemplate.get(job.template_id) ?? '',
            model: job.model,
            temperature: job.generation_config?.temperature,
            maxOutputTokens: job.generation_config?.maxOutputTokens,
            safetyMode: job.safety_mode ?? false,
        })
    );

    const scheduled = scheduleResults.some((result) => result.scheduled);

    await supabase
        .from('compare_sessions')
        .update({
            status: scheduled ? 'running' : 'failed',
            completed_at: null,
            last_error: scheduled
                ? null
                : 'Unable to resume compare jobs. Check GEMINI_API_KEY or client API key.',
        })
        .eq('id', compareId);

    if (!scheduled) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    'Failed to resume compare jobs. Configure GEMINI_API_KEY on server or pass a valid client API key.',
            },
            { status: 400 }
        );
    }

    return NextResponse.json({ ok: true, scheduled: true });
}
