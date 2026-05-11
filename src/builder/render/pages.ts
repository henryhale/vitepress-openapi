import type { IRenderFunctionContext } from "../types";
import { ParsedOpenAPI, ParsedOperation } from "@/types";

export function renderIndexPage(ctx: IRenderFunctionContext) {
    const result = ctx.spec;
    const info = ctx.spec.getInfo()
    const operations = Object.entries(result.getPaths()).map(([path, pathItem]) => {
    const operations = Object.entries(pathItem).filter(([method]) => ['get', 'post', 'put', 'delete', 'patch'].includes(method))
    if (operations.length === 0) return null

    return `
### ${path}

${operations.map(([method, operation]) => `- [**${method.toUpperCase()}**](/operations/${operation?.operationId || `${method}_${path.replace(/\//g, '_')}`}): ${operation.summary || 'No summary'}`).join('\n')}
`}).filter(Boolean).join('\n') || 'No paths defined'

    const servers = result.getServers()?.map(server => `- ${server.url} (${server.description || 'No description'})`).join('\n') || 'No servers defined'
    
    return `
# ${info?.title || 'API Documentation'} - ${info?.version || ''}

${info?.description || ''}

## Contact

<a target="_blank" href=${info?.contact?.url || '#'}>${info?.contact?.name || 'Contact'}</a> /
<a href="mailto:${info?.contact?.email || '#'}">${info?.contact?.email || 'Email'}</a>

## Servers

\`\`\`
${servers}
\`\`\`

## Operations

${operations}

`
}

export function renderOperationPage(ctx: IRenderFunctionContext) {
    const operation = ctx.operation;
    if (!operation) return 'Operation not found';
    const parameters = ctx.renderers.parameters(ctx, operation.parameters)
    const requestBody = ctx.renderers.requestBody(ctx, operation.requestBody)
    const responses = ctx.renderers.responses(ctx, operation.responses)

    return `
# ${operation.summary}

${operation.description || 'No description'}

${parameters}

${requestBody}

${responses}
`
}