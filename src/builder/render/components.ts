import type {IRenderFunctionContext} from "../types"
import type {ParsedOperation} from "@/types"

export function renderFooter(ctx: IRenderFunctionContext) {
    return `<span class="text-sm text-muted-foreground text-center">
Powered by <a
    href="https://github.com/enzonotario/vitepress-openapi"
    target="_blank"
    class="text-primary-foreground"
>
    VitePress OpenAPI
</a>
</span>`
}

export function renderOperationLink(ctx: IRenderFunctionContext, options: { method: string, href: string, title?: string }) {
    return `<${options.href ? 'a' : 'span'} href="${options.href || '#'}" class="OAOperationLink group/oaOperationLink">
    <span class="OAOperationLink-badge OAMethodBadge--${options.method.toLowerCase()}">
      ${options.method.toUpperCase()}
    </span>
    <span class="OAOperationLink-title">${options.title ?? ""}</span>
  </component>`
}

export function renderServers(ctx: IRenderFunctionContext, servers: ParsedOperation['servers']) {
    if (!servers || servers.length === 0) {
        return 'No servers defined'
    }
    
    return `<div>

## Servers
    

<div class="flex flex-col space-y-4">
    ${servers.map(server => `<div class="flex flex-col p-3 gap-2 rounded bg-muted overflow-x-auto">
        <span class="font-semibold select-all">
          ${server.url}
        </span>

        ${server.description ? `<span class="text-muted-foreground">${server.description}</span>` : ''}
      </div>
`).join('\n')}
</div>
</div>
`
}

export function renderSecurity(ctx: IRenderFunctionContext, security: ParsedOperation['security']) {
    if (!security || security.length === 0) {
        return 'No security requirements defined'
    }

    return `<div>

## Security Requirements

<div class="flex flex-col space-y-4">
    ${security.map(requirement => `<div class="flex flex-col p-3 gap-2 rounded bg-muted overflow-x-auto">
        ${Object.entries(requirement).map(([name, scopes]) => `<div>
          <span class="font-semibold">${name}</span>
          ${scopes.length > 0 ? `<span>: ${scopes.join(', ')}</span>` : ''}
        </div>`).join('\n')}
      </div>
`).join('\n')}
</div>
</div>
`
}

export function renderParameters(ctx: IRenderFunctionContext, parameters: ParsedOperation['parameters']) {
    if (!parameters || parameters.length === 0) {
        return 'No parameters defined'
    }

    return `
## Parameters

${parameters.map((param) => `- **${param.name}** (${param.in}): ${param.description || 'No description'}`).join('\n')}
`
}

export function renderRequestBody(ctx: IRenderFunctionContext, requestBody: ParsedOperation['requestBody']) {
    if (!requestBody) {
        return 'No request body defined'
    }

    return `
## Request Body

- **Content Types**: ${Object.keys(requestBody.content || {}).join(', ')}
- **Description**: ${requestBody.description || 'No description'}
`
}

export function renderResponses(ctx: IRenderFunctionContext, responses: ParsedOperation['responses']) {
    if (!responses || Object.keys(responses).length === 0) {
        return 'No responses defined'
    }

    return `
## Responses

${Object.entries(responses).map(([status, response]) => `- **${status}**: ${response.description || 'No description'}`).join('\n')}
`
}

