"use strict";
/**
 * JSONL Compiler — The "magic" behind the Batch Builder
 *
 * Extracts {{variables}} from prompt templates,
 * substitutes values, and compiles to JSONL format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractVariables = extractVariables;
exports.compilePrompt = compilePrompt;
exports.compileToJsonlObjects = compileToJsonlObjects;
exports.compileToJsonl = compileToJsonl;
exports.validateTemplate = validateTemplate;
// Extract all {{variable}} placeholders from a template string
function extractVariables(template) {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set();
    let match;
    while ((match = regex.exec(template)) !== null) {
        variables.add(match[1]);
    }
    return Array.from(variables);
}
// Substitute variables into a template
function compilePrompt(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return variables[key] ?? `{{${key}}}`;
    });
}
// Compile rows into an array of JSONL request objects
function compileToJsonlObjects(options) {
    const { userPromptTemplate, systemPrompt, model = 'gemini-2.5-flash', temperature = 0.7, maxOutputTokens = 1024, rows, } = options;
    return rows.map((row, index) => {
        const compiledPrompt = compilePrompt(userPromptTemplate, row.values);
        const request = {
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
function compileToJsonl(options) {
    const objects = compileToJsonlObjects(options);
    return objects.map((obj) => JSON.stringify(obj)).join('\n');
}
function validateTemplate(template, rows) {
    const errors = [];
    const warnings = [];
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
