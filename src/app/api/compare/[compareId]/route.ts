import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncCompareSession } from '@/lib/compare-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ compareId: string }> }
) {
    const { compareId } = await params;
    if (!compareId) {
        return NextResponse.json({ error: 'Missing compareId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const synced = await syncCompareSession(compareId);

    const { data: session } = await supabase
        .from('compare_sessions')
        .select('*')
        .eq('id', compareId)
        .single();

    if (!session) {
        return NextResponse.json({ error: 'Compare session not found' }, { status: 404 });
    }

    return NextResponse.json({
        ...session,
        status: synced.status,
        total_cases: synced.totalCases,
        completed_cases: synced.completedCases,
        failed_cases: synced.failedCases,
    });
}
