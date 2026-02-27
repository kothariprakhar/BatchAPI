import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scheduleBatchExecution } from '@/lib/batch-runner';
import {
    buildCompiledPrompt,
    type CompareCreatePayload,
    type CompareSideConfig,
} from '@/lib/compare';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function normalizeSideConfig(side: Partial<CompareSideConfig>): CompareSideConfig {
    return {
        systemPrompt: side.systemPrompt ?? '',
        userPromptTemplate: side.userPromptTemplate ?? '',
        model: side.model ?? 'gemini-2.5-flash',
        temperature: side.temperature ?? 0.7,
        maxOutputTokens: side.maxOutputTokens ?? 1024,
    };
}

export async function POST(request: NextRequest) {
    const body = (await request.json()) as Partial<CompareCreatePayload>;

    if (!body.projectId || !body.left || !body.right || !body.rows?.length) {
        return NextResponse.json(
            { error: 'Missing required fields (projectId, left, right, rows)' },
            { status: 400 }
        );
    }

    const left = normalizeSideConfig(body.left);
    const right = normalizeSideConfig(body.right);
    const rows = body.rows;
    const compareType = body.compareType ?? 'prompt_vs_prompt';

    if (!left.userPromptTemplate.trim() || !right.userPromptTemplate.trim()) {
        return NextResponse.json({ error: 'Both prompt templates are required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const compareName = body.name?.trim() || `Compare ${new Date().toLocaleString()}`;

    const { data: leftTemplate } = await supabase
        .from('prompt_templates')
        .insert({
            project_id: body.projectId,
            name: `${compareName} — Left`,
            system_prompt: left.systemPrompt,
            user_prompt_template: left.userPromptTemplate,
            model: left.model,
            generation_config: {
                temperature: left.temperature,
                maxOutputTokens: left.maxOutputTokens,
            },
        })
        .select('id')
        .single();

    const { data: rightTemplate } = await supabase
        .from('prompt_templates')
        .insert({
            project_id: body.projectId,
            name: `${compareName} — Right`,
            system_prompt: right.systemPrompt,
            user_prompt_template: right.userPromptTemplate,
            model: right.model,
            generation_config: {
                temperature: right.temperature,
                maxOutputTokens: right.maxOutputTokens,
            },
        })
        .select('id')
        .single();

    const { data: leftJob } = await supabase
        .from('batch_jobs')
        .insert({
            project_id: body.projectId,
            template_id: leftTemplate?.id,
            name: `${compareName} — Left`,
            queue_status: 'queued',
            status: 'pending',
            total_requests: rows.length,
            model: left.model,
            generation_config: {
                temperature: left.temperature,
                maxOutputTokens: left.maxOutputTokens,
            },
            safety_mode: false,
        })
        .select('id')
        .single();

    const { data: rightJob } = await supabase
        .from('batch_jobs')
        .insert({
            project_id: body.projectId,
            template_id: rightTemplate?.id,
            name: `${compareName} — Right`,
            queue_status: 'queued',
            status: 'pending',
            total_requests: rows.length,
            model: right.model,
            generation_config: {
                temperature: right.temperature,
                maxOutputTokens: right.maxOutputTokens,
            },
            safety_mode: false,
        })
        .select('id')
        .single();

    if (!leftJob || !rightJob) {
        return NextResponse.json({ error: 'Failed to create compare jobs' }, { status: 500 });
    }

    const leftResultsPayload = rows.map((row, index) => ({
        job_id: leftJob.id,
        row_index: index,
        input_variables: row.values,
        compiled_prompt: buildCompiledPrompt(left.userPromptTemplate, row.values),
        status: 'pending',
    }));

    const rightResultsPayload = rows.map((row, index) => ({
        job_id: rightJob.id,
        row_index: index,
        input_variables: row.values,
        compiled_prompt: buildCompiledPrompt(right.userPromptTemplate, row.values),
        status: 'pending',
    }));

    const { data: leftResults } = await supabase
        .from('batch_results')
        .insert(leftResultsPayload)
        .select('id, row_index');

    const { data: rightResults } = await supabase
        .from('batch_results')
        .insert(rightResultsPayload)
        .select('id, row_index');

    const { data: compareSession } = await supabase
        .from('compare_sessions')
        .insert({
            project_id: body.projectId,
            name: compareName,
            compare_type: compareType,
            status: 'queued',
            left_job_id: leftJob.id,
            right_job_id: rightJob.id,
            total_cases: rows.length,
        })
        .select('id')
        .single();

    if (!compareSession) {
        return NextResponse.json({ error: 'Failed to create compare session' }, { status: 500 });
    }

    const compareCasesPayload = rows.map((row, index) => ({
        compare_session_id: compareSession.id,
        row_index: index,
        input_variables: row.values,
        compiled_left_prompt: buildCompiledPrompt(left.userPromptTemplate, row.values),
        compiled_right_prompt: buildCompiledPrompt(right.userPromptTemplate, row.values),
    }));

    const { data: compareCases } = await supabase
        .from('compare_cases')
        .insert(compareCasesPayload)
        .select('id, row_index');

    const leftByIndex = new Map((leftResults ?? []).map((entry) => [entry.row_index, entry.id]));
    const rightByIndex = new Map((rightResults ?? []).map((entry) => [entry.row_index, entry.id]));

    const compareResultsPayload = (compareCases ?? []).map((compareCase) => ({
        compare_case_id: compareCase.id,
        left_result_id: leftByIndex.get(compareCase.row_index) ?? null,
        right_result_id: rightByIndex.get(compareCase.row_index) ?? null,
        status: 'pending',
    }));

    if (compareResultsPayload.length > 0) {
        await supabase.from('compare_results').insert(compareResultsPayload);
    }

    const leftSchedule = scheduleBatchExecution({
        jobId: leftJob.id,
        apiKey: body.apiKey,
        systemPrompt: left.systemPrompt,
        model: left.model,
        temperature: left.temperature,
        maxOutputTokens: left.maxOutputTokens,
    });

    const rightSchedule = scheduleBatchExecution({
        jobId: rightJob.id,
        apiKey: body.apiKey,
        systemPrompt: right.systemPrompt,
        model: right.model,
        temperature: right.temperature,
        maxOutputTokens: right.maxOutputTokens,
    });

    const scheduled = leftSchedule.scheduled || rightSchedule.scheduled;

    await supabase
        .from('compare_sessions')
        .update({
            status: scheduled ? 'running' : 'failed',
            last_error: scheduled
                ? null
                : 'Unable to schedule compare jobs. Check GEMINI_API_KEY or client API key.',
        })
        .eq('id', compareSession.id);

    if (!scheduled) {
        return NextResponse.json(
            {
                error:
                    'Failed to schedule compare jobs. Configure GEMINI_API_KEY on server or pass a valid client API key.',
            },
            { status: 400 }
        );
    }

    return NextResponse.json(
        {
            compareId: compareSession.id,
            leftJobId: leftJob.id,
            rightJobId: rightJob.id,
            status: 'running',
        },
        { status: 202 }
    );
}
