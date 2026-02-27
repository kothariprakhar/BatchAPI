import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;

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
                const { data: job } = await supabase
                    .from('batch_jobs')
                    .select('id, queue_status, status, completed_requests, failed_requests, total_requests, retry_count, heartbeat_at, paused_until, completed_at, last_error')
                    .eq('id', jobId)
                    .single();

                if (!job) {
                    controller.enqueue(encoder.encode(`event: end\ndata: ${JSON.stringify({ reason: 'not_found' })}\n\n`));
                    close();
                    return;
                }

                const payload = JSON.stringify(job);
                if (payload !== lastPayload) {
                    lastPayload = payload;
                    controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }

                const state = job.queue_status ?? job.status;
                if (TERMINAL_STATES.has(state)) {
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
            // no-op: handled in close() path
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
