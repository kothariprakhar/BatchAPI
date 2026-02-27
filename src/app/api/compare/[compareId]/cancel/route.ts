import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ compareId: string }> }
) {
    const { compareId } = await params;
    if (!compareId) {
        return NextResponse.json({ error: 'Missing compareId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: session } = await supabase
        .from('compare_sessions')
        .select('left_job_id, right_job_id')
        .eq('id', compareId)
        .single();

    if (!session) {
        return NextResponse.json({ error: 'Compare session not found' }, { status: 404 });
    }

    const jobIds = [session.left_job_id, session.right_job_id].filter(Boolean);

    if (jobIds.length > 0) {
        await supabase
            .from('batch_jobs')
            .update({
                cancel_requested: true,
                queue_status: 'cancelled',
                status: 'cancelled',
                completed_at: new Date().toISOString(),
                heartbeat_at: new Date().toISOString(),
            })
            .in('id', jobIds as string[]);

        await supabase
            .from('batch_results')
            .update({
                status: 'pending',
                updated_at: new Date().toISOString(),
            })
            .in('job_id', jobIds as string[])
            .eq('status', 'running');
    }

    await supabase
        .from('compare_sessions')
        .update({
            status: 'cancelled',
            completed_at: new Date().toISOString(),
            last_error: 'Cancelled by user',
        })
        .eq('id', compareId);

    return NextResponse.json({ ok: true });
}
