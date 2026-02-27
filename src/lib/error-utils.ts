export interface ErrorMeta {
    message: string;
    statusCode: number | null;
    errorType: string;
    retryable: boolean;
    rateLimited: boolean;
}

function extractStatusCode(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const candidate = error as Record<string, unknown>;

    const direct = candidate.status ?? candidate.code;
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

    const nested = candidate.error;
    if (nested && typeof nested === 'object') {
        const nestedRecord = nested as Record<string, unknown>;
        if (typeof nestedRecord.code === 'number' && Number.isFinite(nestedRecord.code)) {
            return nestedRecord.code;
        }
    }

    const message = String(candidate.message ?? '');
    const statusFromMessage = message.match(/\b(4\d\d|5\d\d)\b/);
    if (statusFromMessage) return Number(statusFromMessage[1]);

    return null;
}

export function classifyError(error: unknown): ErrorMeta {
    const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    const statusCode = extractStatusCode(error);
    const rateLimited = statusCode === 429 || message.includes('429');
    const retryableServer = statusCode !== null && statusCode >= 500 && statusCode <= 599;
    const retryable = rateLimited || retryableServer;

    let errorType = 'unknown_error';
    if (rateLimited) {
        errorType = 'rate_limit';
    } else if (retryableServer) {
        errorType = 'server_error';
    } else if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
        errorType = 'client_error';
    } else if (error instanceof Error) {
        errorType = 'runtime_error';
    }

    return {
        message,
        statusCode,
        errorType,
        retryable,
        rateLimited,
    };
}
