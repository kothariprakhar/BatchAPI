'use client';

import { useMemo } from 'react';
import { compileToJsonl, compileToJsonlObjects, type CompileOptions } from '@/lib/jsonl-compiler';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, FileJson2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JsonlPreviewProps {
    options: CompileOptions;
}

export function JsonlPreview({ options }: JsonlPreviewProps) {
    const jsonlObjects = useMemo(() => compileToJsonlObjects(options), [options]);
    const jsonlString = useMemo(() => compileToJsonl(options), [options]);
    const isEmpty = options.rows.length === 0 || !options.userPromptTemplate.trim();

    const handleCopy = () => {
        navigator.clipboard.writeText(jsonlString);
    };

    const handleDownload = () => {
        const blob = new Blob([jsonlString], { type: 'application/jsonl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'batch-requests.jsonl';
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isEmpty) {
        return (
            <div className="rounded-xl border border-dashed border-border p-8 text-center h-full flex items-center justify-center">
                <div className="space-y-2">
                    <FileJson2 className="h-8 w-8 mx-auto text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                        Add a prompt template and data rows to see the compiled JSONL
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Compiled Output
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                        {jsonlObjects.length} request{jsonlObjects.length !== 1 ? 's' : ''}
                    </Badge>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                        <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
                        <Download className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            {/* Formatted Preview */}
            <ScrollArea className="flex-1 rounded-lg border border-border bg-muted/20">
                <div className="p-4 space-y-3">
                    {jsonlObjects.map((obj, index) => (
                        <div key={index} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground">
                                    Line {index + 1}
                                </span>
                                <span className={cn(
                                    'text-[10px] font-mono px-1.5 py-0.5 rounded',
                                    'bg-emerald-500/10 text-emerald-400'
                                )}>
                                    {obj.custom_id}
                                </span>
                            </div>
                            <pre className="text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all bg-background/50 rounded-md p-3 border border-border/50">
                                {JSON.stringify(obj, null, 2)}
                            </pre>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
