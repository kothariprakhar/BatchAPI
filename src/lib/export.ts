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
