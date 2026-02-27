/**
 * JSONL Compiler — The "magic" behind the Batch Builder
 *
 * Extracts {{variables}} from prompt templates,
 * substitutes values, and compiles to JSONL format.
 */

// Extract all {{variable}} placeholders from a template string
export function extractVariables(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;
    while ((match = regex.exec(template)) !== null) {
        variables.add(match[1]);
    }
    return Array.from(variables);
}

// Substitute variables into a template
export function compilePrompt(
    template: string,
    variables: Record<string, string>
): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return variables[key] ?? `{{${key}}}`;
    });
}

// A single row of variable data
export interface VariableRow {
    id: string;
    values: Record<string, string>;
}

// JSONL request format for Gemini batch
export interface JsonlRequest {
    custom_id: string;
    model: string;
    contents: Array<{
        role: string;
        parts: Array<{ text: string }>;
    }>;
    systemInstruction?: {
        parts: Array<{ text: string }>;
    };
    generationConfig?: {
        temperature?: number;
        maxOutputTokens?: number;
    };
}

export interface CompileOptions {
    userPromptTemplate: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    rows: VariableRow[];
}

// Compile rows into an array of JSONL request objects
export function compileToJsonlObjects(options: CompileOptions): JsonlRequest[] {
    const {
        userPromptTemplate,
        systemPrompt,
        model = 'gemini-2.5-flash',
        temperature = 0.7,
        maxOutputTokens = 1024,
        rows,
    } = options;

    return rows.map((row, index) => {
        const compiledPrompt = compilePrompt(userPromptTemplate, row.values);

        const request: JsonlRequest = {
            custom_id: `request-${index + 1}`,
            model,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: compiledPrompt }],
                },
            ],
            generationConfig: {
                temperature,
                maxOutputTokens,
            },
        };

        if (systemPrompt?.trim()) {
            request.systemInstruction = {
                parts: [{ text: systemPrompt }],
            };
        }

        return request;
    });
}

// Compile to JSONL string (one JSON object per line)
export function compileToJsonl(options: CompileOptions): string {
    const objects = compileToJsonlObjects(options);
    return objects.map((obj) => JSON.stringify(obj)).join('\n');
}

// Validation
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export function validateTemplate(
    template: string,
    rows: VariableRow[]
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const variables = extractVariables(template);

    if (!template.trim()) {
        errors.push('Prompt template is empty');
    }

    if (variables.length === 0 && template.trim()) {
        warnings.push('Template has no {{variables}} — all rows will produce identical prompts');
    }

    if (rows.length === 0) {
        errors.push('No variable rows defined. Add at least one row of test data.');
    }

    // Check for empty values
    rows.forEach((row, index) => {
        variables.forEach((variable) => {
            if (!row.values[variable]?.trim()) {
                warnings.push(`Row ${index + 1}: variable "{{${variable}}}" is empty`);
            }
        });
    });

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
