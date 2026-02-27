/**
 * Export utilities for batch results
 */

interface ExportResult {
    row: number;
    input_variables: Record<string, string>;
    compiled_prompt: string;
    output: string | null;
    status: string;
    latency_ms: number | null;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    error: string | null;
}

interface CompareExportResult {
    row: number;
    input_variables: Record<string, string>;
    left_prompt: string;
    right_prompt: string;
    left_output: string | null;
    right_output: string | null;
    left_status: string | null;
    right_status: string | null;
    left_latency_ms: number | null;
    right_latency_ms: number | null;
    left_tokens: number;
    right_tokens: number;
    pair_status: 'pending' | 'completed' | 'failed';
    changed: boolean;
    length_delta: number;
    first_difference_at: number;
    formatting_shift: boolean;
    possible_hallucination_shift: boolean;
    major_length_shift: boolean;
}

export function exportToCsv(results: ExportResult[], jobName: string): void {
    if (results.length === 0) return;

    // Get all unique variable keys
    const variableKeys = new Set<string>();
    results.forEach((r) => {
        Object.keys(r.input_variables).forEach((k) => variableKeys.add(k));
    });

    const headers = [
        'Row',
        ...Array.from(variableKeys),
        'Compiled Prompt',
        'Output',
        'Status',
        'Latency (ms)',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Tokens',
        'Error',
    ];

    const rows = results.map((r) => [
        r.row,
        ...Array.from(variableKeys).map((k) => escapeCsv(r.input_variables[k] ?? '')),
        escapeCsv(r.compiled_prompt),
        escapeCsv(r.output ?? ''),
        r.status,
        r.latency_ms ?? '',
        r.prompt_tokens,
        r.completion_tokens,
        r.total_tokens,
        escapeCsv(r.error ?? ''),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(csv, `${jobName}.csv`, 'text/csv');
}

export function exportToJson(results: ExportResult[], jobName: string): void {
    const json = JSON.stringify(results, null, 2);
    downloadFile(json, `${jobName}.json`, 'application/json');
}

export function exportCompareToCsv(results: CompareExportResult[], compareName: string): void {
    if (results.length === 0) return;

    const variableKeys = new Set<string>();
    results.forEach((result) => {
        Object.keys(result.input_variables).forEach((key) => variableKeys.add(key));
    });

    const headers = [
        'Row',
        ...Array.from(variableKeys),
        'Left Prompt',
        'Right Prompt',
        'Left Output',
        'Right Output',
        'Left Status',
        'Right Status',
        'Pair Status',
        'Left Latency (ms)',
        'Right Latency (ms)',
        'Left Tokens',
        'Right Tokens',
        'Changed',
        'Length Delta',
        'First Difference At',
        'Formatting Shift',
        'Possible Hallucination Shift',
        'Major Length Shift',
    ];

    const rows = results.map((result) => [
        result.row,
        ...Array.from(variableKeys).map((key) => escapeCsv(result.input_variables[key] ?? '')),
        escapeCsv(result.left_prompt),
        escapeCsv(result.right_prompt),
        escapeCsv(result.left_output ?? ''),
        escapeCsv(result.right_output ?? ''),
        result.left_status ?? '',
        result.right_status ?? '',
        result.pair_status,
        result.left_latency_ms ?? '',
        result.right_latency_ms ?? '',
        result.left_tokens,
        result.right_tokens,
        result.changed,
        result.length_delta,
        result.first_difference_at,
        result.formatting_shift,
        result.possible_hallucination_shift,
        result.major_length_shift,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    downloadFile(csv, `${compareName}.csv`, 'text/csv');
}

export function exportCompareToJson(results: CompareExportResult[], compareName: string): void {
    const json = JSON.stringify(results, null, 2);
    downloadFile(json, `${compareName}.json`, 'application/json');
}

function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
