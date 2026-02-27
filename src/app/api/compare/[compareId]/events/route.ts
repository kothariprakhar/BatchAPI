import { createClient } from '@supabase/supabase-js';
import { syncCompareSession } from '@/lib/compare-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TERMINAL_STATES = new Set(['completed', 'partial_failed', 'failed', 'cancelled']);

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ compareId: string }> }
) {
    const { compareId } = await params;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            let lastPayload = '';

            const close = () => {
                if (closed) return;
                closed = true;
                if (pollTimer) clearInterval(pollTimer);
                if (heartbeatTimer) clearInterval(heartbeatTimer);
                controller.close();
            };

            const poll = async () => {
                const synced = await syncCompareSession(compareId);
                const { data: session } = await supabase
                    .from('compare_sessions')
                    .select('id, name, status, total_cases, completed_cases, failed_cases, left_job_id, right_job_id, last_error, created_at, completed_at')
                    .eq('id', compareId)
                    .single();

                if (!session) {
                    controller.enqueue(encoder.encode(`event: end\ndata: ${JSON.stringify({ reason: 'not_found' })}\n\n`));
                    close();
                    return;
                }

                const payload = JSON.stringify({
                    ...session,
                    status: synced.status,
                    total_cases: synced.totalCases,
                    completed_cases: synced.completedCases,
                    failed_cases: synced.failedCases,
                });

                if (payload !== lastPayload) {
                    lastPayload = payload;
                    controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }

                if (TERMINAL_STATES.has(synced.status)) {
                    controller.enqueue(encoder.encode(`event: end\ndata: ${payload}\n\n`));
                    close();
                }
            };

            const pollTimer = setInterval(() => {
                void poll();
            }, 2000);

            const heartbeatTimer = setInterval(() => {
                controller.enqueue(encoder.encode(': keepalive\n\n'));
            }, 15000);

            void poll();
        },
        cancel() {
            // no-op
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}
