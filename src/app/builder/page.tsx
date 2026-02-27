'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PromptEditor } from '@/components/prompt-editor';
import { VariableTable } from '@/components/variable-table';
import { JsonlPreview } from '@/components/jsonl-preview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useApiKey } from '@/lib/api-key-context';
import { supabase, getDeviceId } from '@/lib/supabase';
import {
    extractVariables,
    validateTemplate,
    type VariableRow,
    type CompileOptions,
} from '@/lib/jsonl-compiler';
import {
    Hammer,
    Play,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';

export default function BuilderPage() {
    const router = useRouter();
    const { apiKey, isValid: apiKeyValid } = useApiKey();

    // Prompt state
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userPromptTemplate, setUserPromptTemplate] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [maxOutputTokens, setMaxOutputTokens] = useState(1024);
    const [rows, setRows] = useState<VariableRow[]>([]);
    const [safetyMode, setSafetyMode] = useState(false);
    const [jobName, setJobName] = useState('');

    // UI state
    const [isRunning, setIsRunning] = useState(false);
    const [showRunDialog, setShowRunDialog] = useState(false);

    // Load template from sessionStorage (set by Templates page)
    useEffect(() => {
        const stored = sessionStorage.getItem('gemini-bench-template');
        if (stored) {
            try {
                const template = JSON.parse(stored);
                if (template.systemPrompt) setSystemPrompt(template.systemPrompt);
                if (template.userPromptTemplate) setUserPromptTemplate(template.userPromptTemplate);
                if (template.rows) setRows(template.rows);
                sessionStorage.removeItem('gemini-bench-template');
            } catch {
                // ignore invalid data
            }
        }
    }, []);

    // Extract variables and auto-sync rows
    const variables = useMemo(() => extractVariables(userPromptTemplate), [userPromptTemplate]);

    // When variables change, update existing rows to include new variables
    useEffect(() => {
        if (variables.length === 0) return;

        setRows((prev) => {
            if (prev.length === 0) {
                // Auto-add one row when first variable detected
                return [
                    {
                        id: crypto.randomUUID(),
                        values: Object.fromEntries(variables.map((v) => [v, ''])),
                    },
                ];
            }
            // Add new variable keys to existing rows
            return prev.map((row) => ({
                ...row,
                values: {
                    ...Object.fromEntries(variables.map((v) => [v, ''])),
                    ...row.values,
                },
            }));
        });
    }, [variables]);

    // Compile options
    const compileOptions: CompileOptions = useMemo(
        () => ({
            userPromptTemplate,
            systemPrompt,
            model: 'gemini-1.5-flash',
            temperature,
            maxOutputTokens,
            rows,
        }),
        [userPromptTemplate, systemPrompt, temperature, maxOutputTokens, rows]
    );

    // Validation
    const validation = useMemo(
        () => validateTemplate(userPromptTemplate, rows),
        [userPromptTemplate, rows]
    );

    // Run batch job
    const handleRunBatch = useCallback(async () => {
        if (!apiKey || !apiKeyValid) return;
        setIsRunning(true);

        try {
            const deviceId = getDeviceId();

            // 1. Ensure a default project exists
            let { data: project } = await supabase
                .from('projects')
                .select('id')
                .eq('device_id', deviceId)
                .limit(1)
                .single();

            if (!project) {
                const { data: newProject } = await supabase
                    .from('projects')
                    .insert({ device_id: deviceId, name: 'Default Project' })
                    .select('id')
                    .single();
                project = newProject;
            }

            if (!project) throw new Error('Failed to create project');

            // 2. Save prompt template
            const { data: template } = await supabase
                .from('prompt_templates')
                .insert({
                    project_id: project.id,
                    name: jobName || `Batch ${new Date().toLocaleString()}`,
                    system_prompt: systemPrompt,
                    user_prompt_template: userPromptTemplate,
                    generation_config: { temperature, maxOutputTokens },
                })
                .select('id')
                .single();

            // 3. Create batch job
            const { data: job } = await supabase
                .from('batch_jobs')
                .insert({
                    project_id: project.id,
                    template_id: template?.id,
                    name: jobName || `Batch ${new Date().toLocaleString()}`,
                    status: 'pending',
                    total_requests: rows.length,
                    model: 'gemini-1.5-flash',
                    generation_config: { temperature, maxOutputTokens },
                    safety_mode: safetyMode,
                })
                .select('id')
                .single();

            if (!job) throw new Error('Failed to create batch job');

            // 4. Create batch result placeholders
            const resultRows = rows.map((row, index) => ({
                job_id: job.id,
                row_index: index,
                input_variables: row.values,
                compiled_prompt: userPromptTemplate.replace(
                    /\{\{(\w+)\}\}/g,
                    (_, key) => row.values[key] ?? `{{${key}}}`
                ),
                status: 'pending',
            }));

            await supabase.from('batch_results').insert(resultRows);

            // 5. Trigger execution via API route
            fetch('/api/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId: job.id,
                    apiKey,
                    systemPrompt,
                    model: 'gemini-1.5-flash',
                    temperature,
                    maxOutputTokens,
                    safetyMode,
                }),
            });

            // 6. Navigate to dashboard
            setShowRunDialog(false);
            router.push('/dashboard');
        } catch (error) {
            console.error('Failed to start batch:', error);
        } finally {
            setIsRunning(false);
        }
    }, [apiKey, apiKeyValid, systemPrompt, userPromptTemplate, temperature, maxOutputTokens, rows, safetyMode, jobName, router]);

    return (
        <div className="space-y-6 h-full">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
                        <Hammer className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Batch Builder</h1>
                        <p className="text-sm text-muted-foreground">
                            Create prompt templates, fill variable tables, and compile to batch requests
                        </p>
                    </div>
                </div>

                <Button
                    onClick={() => setShowRunDialog(true)}
                    disabled={!validation.valid || !apiKeyValid}
                    className="gap-2"
                    size="lg"
                >
                    <Play className="h-4 w-4" />
                    Run Batch
                    {validation.valid && rows.length > 0 && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                            {rows.length} request{rows.length !== 1 ? 's' : ''}
                        </Badge>
                    )}
                </Button>
            </div>

            {/* Validation Messages */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="space-y-2">
                    {validation.errors.map((err, i) => (
                        <div key={`err-${i}`} className="flex items-center gap-2 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {err}
                        </div>
                    ))}
                    {validation.warnings.map((warn, i) => (
                        <div key={`warn-${i}`} className="flex items-center gap-2 text-sm text-amber-500">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {warn}
                        </div>
                    ))}
                </div>
            )}

            {/* Main Layout: Prompt Editor + Variable Table + Preview */}
            <Tabs defaultValue="build" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="build" className="gap-2">
                        <Sparkles className="h-3.5 w-3.5" />
                        Build
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Preview JSONL
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="build" className="space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Left: Prompt Editor */}
                        <Card className="bg-card/50">
                            <CardContent className="pt-6">
                                <PromptEditor
                                    systemPrompt={systemPrompt}
                                    userPromptTemplate={userPromptTemplate}
                                    temperature={temperature}
                                    maxOutputTokens={maxOutputTokens}
                                    onSystemPromptChange={setSystemPrompt}
                                    onUserPromptChange={setUserPromptTemplate}
                                    onTemperatureChange={setTemperature}
                                    onMaxOutputTokensChange={setMaxOutputTokens}
                                />
                            </CardContent>
                        </Card>

                        {/* Right: Variable Table */}
                        <Card className="bg-card/50">
                            <CardContent className="pt-6">
                                <VariableTable
                                    variables={variables}
                                    rows={rows}
                                    onRowsChange={setRows}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="preview">
                    <Card className="bg-card/50 min-h-[400px]">
                        <CardContent className="pt-6 h-full">
                            <JsonlPreview options={compileOptions} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Run Dialog */}
            <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Play className="h-5 w-5" />
                            Run Batch Job
                        </DialogTitle>
                        <DialogDescription>
                            Execute {rows.length} prompt{rows.length !== 1 ? 's' : ''} against Gemini 1.5 Flash
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Job Name</Label>
                            <Input
                                placeholder={`Batch ${new Date().toLocaleDateString()}`}
                                value={jobName}
                                onChange={(e) => setJobName(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                                <div>
                                    <p className="text-sm font-medium">Safety Mode</p>
                                    <p className="text-xs text-muted-foreground">
                                        Rate limit to 10 RPM with wider spacing (recommended for free tier)
                                    </p>
                                </div>
                            </div>
                            <Switch checked={safetyMode} onCheckedChange={setSafetyMode} />
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-3 rounded-lg bg-muted/30">
                                <p className="text-2xl font-bold">{rows.length}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Requests</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30">
                                <p className="text-2xl font-bold">{safetyMode ? '10' : '15'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">RPM Limit</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30">
                                <p className="text-2xl font-bold">
                                    ~{Math.ceil(rows.length / (safetyMode ? 10 : 15))}m
                                </p>
                                <p className="text-[10px] text-muted-foreground uppercase">Est. Time</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowRunDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRunBatch} disabled={isRunning} className="gap-2">
                            {isRunning ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    Start Batch
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
