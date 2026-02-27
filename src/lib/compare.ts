import { compilePrompt, type VariableRow } from './jsonl-compiler';

export type CompareType = 'prompt_vs_prompt' | 'model_vs_model';

export interface CompareSideConfig {
    systemPrompt: string;
    userPromptTemplate: string;
    model: string;
    temperature: number;
    maxOutputTokens: number;
}

export interface CompareCreatePayload {
    projectId: string;
    name: string;
    compareType: CompareType;
    left: CompareSideConfig;
    right: CompareSideConfig;
    rows: VariableRow[];
    apiKey?: string;
}

export interface CompareDiffSummary {
    changed: boolean;
    leftLength: number;
    rightLength: number;
    lengthDelta: number;
    firstDifferenceAt: number;
}

export interface CompareFlags {
    formattingShift: boolean;
    possibleHallucinationShift: boolean;
    majorLengthShift: boolean;
}

export interface CompareStatusInput {
    jobStatuses: string[];
    totalCases: number;
    completedCases: number;
    failedCases: number;
    previousStatus: string;
}

export function buildCompiledPrompt(
    template: string,
    variables: Record<string, string>
): string {
    return compilePrompt(template, variables);
}

export function computeDiffSummary(
    leftOutput: string | null | undefined,
    rightOutput: string | null | undefined
): CompareDiffSummary {
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

export function computeFlags(
    leftOutput: string | null | undefined,
    rightOutput: string | null | undefined
): CompareFlags {
    const left = leftOutput ?? '';
    const right = rightOutput ?? '';

    const leftLooksStructured = left.includes('{') || left.includes('- ') || left.includes('1.');
    const rightLooksStructured = right.includes('{') || right.includes('- ') || right.includes('1.');

    const lengthRatio =
        Math.max(left.length, right.length) > 0
            ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
            : 1;

    return {
        formattingShift: leftLooksStructured !== rightLooksStructured,
        possibleHallucinationShift:
            left.length > 0 &&
            right.length > 0 &&
            Math.abs(left.length - right.length) > 500,
        majorLengthShift: lengthRatio < 0.5,
    };
}

export function deriveCompareSessionStatus(input: CompareStatusInput): string {
    const allTerminal =
        input.jobStatuses.length > 0 &&
        input.jobStatuses.every((status) =>
            ['completed', 'failed', 'cancelled'].includes(status)
        );
    const hasCancelled = input.jobStatuses.includes('cancelled');
    const hasFailed = input.jobStatuses.includes('failed');
    const bothCompleted =
        input.jobStatuses.length > 0 &&
        input.jobStatuses.every((status) => status === 'completed');

    if (hasCancelled) return 'cancelled';

    if (!allTerminal) {
        if (
            input.jobStatuses.some((status) =>
                ['running', 'retry_wait', 'paused'].includes(status)
            )
        ) {
            return 'running';
        }
        return 'queued';
    }

    if (bothCompleted && input.failedCases === 0) return 'completed';
    if (bothCompleted && input.failedCases > 0) return 'partial_failed';
    if (hasFailed && input.completedCases > 0) return 'partial_failed';
    if (hasFailed) return 'failed';
    return input.previousStatus;
}
