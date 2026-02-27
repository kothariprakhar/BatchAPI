"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCompiledPrompt = buildCompiledPrompt;
exports.computeDiffSummary = computeDiffSummary;
exports.computeFlags = computeFlags;
exports.deriveCompareSessionStatus = deriveCompareSessionStatus;
const jsonl_compiler_1 = require("./jsonl-compiler");
function buildCompiledPrompt(template, variables) {
    return (0, jsonl_compiler_1.compilePrompt)(template, variables);
}
function computeDiffSummary(leftOutput, rightOutput) {
    const left = leftOutput ?? '';
    const right = rightOutput ?? '';
    let firstDifferenceAt = -1;
    const max = Math.max(left.length, right.length);
    for (let index = 0; index < max; index++) {
        if (left[index] !== right[index]) {
            firstDifferenceAt = index;
            break;
        }
    }
    return {
        changed: left !== right,
        leftLength: left.length,
        rightLength: right.length,
        lengthDelta: right.length - left.length,
        firstDifferenceAt,
    };
}
function computeFlags(leftOutput, rightOutput) {
    const left = leftOutput ?? '';
    const right = rightOutput ?? '';
    const leftLooksStructured = left.includes('{') || left.includes('- ') || left.includes('1.');
    const rightLooksStructured = right.includes('{') || right.includes('- ') || right.includes('1.');
    const lengthRatio = Math.max(left.length, right.length) > 0
        ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
        : 1;
    return {
        formattingShift: leftLooksStructured !== rightLooksStructured,
        possibleHallucinationShift: left.length > 0 &&
            right.length > 0 &&
            Math.abs(left.length - right.length) > 500,
        majorLengthShift: lengthRatio < 0.5,
    };
}
function deriveCompareSessionStatus(input) {
    const allTerminal = input.jobStatuses.length > 0 &&
        input.jobStatuses.every((status) => ['completed', 'failed', 'cancelled'].includes(status));
    const hasCancelled = input.jobStatuses.includes('cancelled');
    const hasFailed = input.jobStatuses.includes('failed');
    const bothCompleted = input.jobStatuses.length > 0 &&
        input.jobStatuses.every((status) => status === 'completed');
    if (hasCancelled)
        return 'cancelled';
    if (!allTerminal) {
        if (input.jobStatuses.some((status) => ['running', 'retry_wait', 'paused'].includes(status))) {
            return 'running';
        }
        return 'queued';
    }
    if (bothCompleted && input.failedCases === 0)
        return 'completed';
    if (bothCompleted && input.failedCases > 0)
        return 'partial_failed';
    if (hasFailed && input.completedCases > 0)
        return 'partial_failed';
    if (hasFailed)
        return 'failed';
    return input.previousStatus;
}
