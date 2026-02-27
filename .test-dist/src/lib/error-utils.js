"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyError = classifyError;
function extractStatusCode(error) {
    if (!error || typeof error !== 'object')
        return null;
    const candidate = error;
    const direct = candidate.status ?? candidate.code;
    if (typeof direct === 'number' && Number.isFinite(direct))
        return direct;
    const nested = candidate.error;
    if (nested && typeof nested === 'object') {
        const nestedRecord = nested;
        if (typeof nestedRecord.code === 'number' && Number.isFinite(nestedRecord.code)) {
            return nestedRecord.code;
        }
    }
    const message = String(candidate.message ?? '');
    const statusFromMessage = message.match(/\b(4\d\d|5\d\d)\b/);
    if (statusFromMessage)
        return Number(statusFromMessage[1]);
    return null;
}
function classifyError(error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    const statusCode = extractStatusCode(error);
    const rateLimited = statusCode === 429 || message.includes('429');
    const retryableServer = statusCode !== null && statusCode >= 500 && statusCode <= 599;
    const retryable = rateLimited || retryableServer;
    let errorType = 'unknown_error';
    if (rateLimited) {
        errorType = 'rate_limit';
    }
    else if (retryableServer) {
        errorType = 'server_error';
    }
    else if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
        errorType = 'client_error';
    }
    else if (error instanceof Error) {
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
