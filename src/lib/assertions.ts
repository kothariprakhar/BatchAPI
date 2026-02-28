export type AssertionType = 'contains' | 'not_contains' | 'regex';

export interface AssertionRule {
    type: AssertionType;
    value: string;
}

export interface AssertionEvaluationResult {
    configured: boolean;
    passed: boolean | null;
    reason: string;
}

export function normalizeAssertionRule(
    rule: Partial<AssertionRule> | null | undefined
): AssertionRule | null {
    if (!rule?.type || !rule.value) return null;
    const value = rule.value.trim();
    if (!value) return null;
    if (!['contains', 'not_contains', 'regex'].includes(rule.type)) return null;
    return {
        type: rule.type as AssertionType,
        value,
    };
}

export function evaluateAssertion(
    output: string | null | undefined,
    rule: Partial<AssertionRule> | null | undefined
): AssertionEvaluationResult {
    const normalized = normalizeAssertionRule(rule);
    if (!normalized) {
        return { configured: false, passed: null, reason: 'No assertion configured' };
    }

    const content = output ?? '';

    if (normalized.type === 'contains') {
        const passed = content.includes(normalized.value);
        return {
            configured: true,
            passed,
            reason: passed ? 'Contains check passed' : `Missing required text: "${normalized.value}"`,
        };
    }

    if (normalized.type === 'not_contains') {
        const passed = !content.includes(normalized.value);
        return {
            configured: true,
            passed,
            reason: passed
                ? 'Not-contains check passed'
                : `Forbidden text found: "${normalized.value}"`,
        };
    }

    try {
        const pattern = new RegExp(normalized.value, 'm');
        const passed = pattern.test(content);
        return {
            configured: true,
            passed,
            reason: passed ? 'Regex check passed' : `Regex did not match: /${normalized.value}/`,
        };
    } catch {
        return {
            configured: true,
            passed: false,
            reason: `Invalid regex: /${normalized.value}/`,
        };
    }
}
