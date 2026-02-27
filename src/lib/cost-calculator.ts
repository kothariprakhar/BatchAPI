/**
 * Cost Calculator
 *
 * Estimates the $ saved by using batch mode (50% discount)
 * vs. standard API pricing for Gemini 2.5 Flash.
 */

// Pricing per 1M tokens (USD) — Gemini 2.5 Flash
const PRICING = {
    'gemini-2.5-flash': {
        standard: { input: 0.075, output: 0.30 },
        batch: { input: 0.0375, output: 0.15 },
    },
} as const;

export interface CostEstimate {
    standardCostUsd: number;
    batchCostUsd: number;
    savingsUsd: number;
    savingsPercent: number;
}

export function calculateSavings(
    model: string,
    promptTokens: number,
    completionTokens: number
): CostEstimate {
    const pricing = PRICING[model as keyof typeof PRICING] ?? PRICING['gemini-2.5-flash'];

    const standardCostUsd =
        (promptTokens / 1_000_000) * pricing.standard.input +
        (completionTokens / 1_000_000) * pricing.standard.output;

    const batchCostUsd =
        (promptTokens / 1_000_000) * pricing.batch.input +
        (completionTokens / 1_000_000) * pricing.batch.output;

    const savingsUsd = standardCostUsd - batchCostUsd;

    return {
        standardCostUsd,
        batchCostUsd,
        savingsUsd,
        savingsPercent: standardCostUsd > 0 ? (savingsUsd / standardCostUsd) * 100 : 0,
    };
}

export function formatUsd(amount: number): string {
    if (amount < 0.01) return `$${amount.toFixed(6)}`;
    return `$${amount.toFixed(4)}`;
}
