import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;
    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error } = await supabase
        .from('batch_jobs')
        .update({
            cancel_requested: true,
            queue_status: 'cancelled',
            status: 'cancelled',
            completed_at: new Date().toISOString(),
            heartbeat_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
        .from('batch_results')
        .update({
            status: 'pending',
            updated_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .eq('status', 'running');

    return NextResponse.json({ ok: true });
}
