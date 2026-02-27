'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Clipboard } from 'lucide-react';
import { type VariableRow } from '@/lib/jsonl-compiler';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface VariableTableProps {
    variables: string[];
    rows: VariableRow[];
    onRowsChange: (rows: VariableRow[]) => void;
}

export function VariableTable({ variables, rows, onRowsChange }: VariableTableProps) {
    const addRow = useCallback(() => {
        const newRow: VariableRow = {
            id: crypto.randomUUID(),
            values: Object.fromEntries(variables.map((v) => [v, ''])),
        };
        onRowsChange([...rows, newRow]);
    }, [rows, variables, onRowsChange]);

    const removeRow = useCallback(
        (id: string) => {
            onRowsChange(rows.filter((r) => r.id !== id));
        },
        [rows, onRowsChange]
    );

    const updateCell = useCallback(
        (rowId: string, variable: string, value: string) => {
            onRowsChange(
                rows.map((r) =>
                    r.id === rowId ? { ...r, values: { ...r.values, [variable]: value } } : r
                )
            );
        },
        [rows, onRowsChange]
    );

    // Paste from spreadsheet (tab-separated values)
    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            const text = e.clipboardData.getData('text/plain');
            if (!text.includes('\t') && !text.includes('\n')) return; // Not tabular data

            e.preventDefault();

            const lines = text.trim().split('\n');
            const newRows: VariableRow[] = lines.map((line) => {
                const cells = line.split('\t');
                const values: Record<string, string> = {};
                variables.forEach((v, i) => {
                    values[v] = cells[i]?.trim() ?? '';
                });
                return { id: crypto.randomUUID(), values };
            });

            onRowsChange([...rows, ...newRows]);
        },
        [rows, variables, onRowsChange]
    );

    if (variables.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                    Add <code className="px-1.5 py-0.5 rounded bg-muted text-blue-400 text-xs font-mono">{'{{variables}}'}</code>{' '}
                    to your prompt template to see the data table
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3" onPaste={handlePaste}>
            {/* Table Header */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Test Data ({rows.length} row{rows.length !== 1 ? 's' : ''})
                </span>
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground">
                                <Clipboard className="h-3 w-3" />
                                Paste from spreadsheet
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-xs">Copy rows from Excel/Sheets and paste here.<br />Uses tab-separated columns.</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${variables.length}, 1fr) 40px` }}>
                {variables.map((v) => (
                    <div key={v} className="text-xs font-mono font-medium text-blue-400 px-1">
                        {`{{${v}}}`}
                    </div>
                ))}
                <div />
            </div>

            {/* Rows */}
            <div className="space-y-1.5">
                {rows.map((row, rowIndex) => (
                    <div
                        key={row.id}
                        className="grid gap-2 group"
                        style={{ gridTemplateColumns: `repeat(${variables.length}, 1fr) 40px` }}
                    >
                        {variables.map((v) => (
                            <Input
                                key={`${row.id}-${v}`}
                                value={row.values[v] ?? ''}
                                onChange={(e) => updateCell(row.id, v, e.target.value)}
                                placeholder={`Row ${rowIndex + 1}`}
                                className="text-sm font-mono h-9 bg-muted/30"
                            />
                        ))}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(row.id)}
                            className="h-9 w-9 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}
            </div>

            {/* Add Row Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={addRow}
                className="w-full border-dashed gap-2 text-muted-foreground hover:text-foreground"
            >
                <Plus className="h-3.5 w-3.5" />
                Add Row
            </Button>
        </div>
    );
}
