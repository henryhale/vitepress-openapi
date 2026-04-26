// stage 0: config
const config = {
    spec: './docs/public/openapi.json',
    output: './dist-ssr/',
    operations: './dist-ssr/operations/',
}

// stage 1: read and parse the OpenAPI spec 
import {existsSync, readFileSync} from "node:fs"

const specContent = JSON.parse(readFileSync(config.spec, 'utf-8'))

import {parseOpenapi} from "../lib/parser/parseOpenapi"
const { transformSync, parseSync } = parseOpenapi()

const parseResult = parseSync({
    spec: specContent,
})

// console.log('Parsed OpenAPI spec:', result)

// stage 2: setup output locations
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { ParsedOperation } from "@/types"

if (!existsSync(config.output)) {
    mkdirSync(dirname(config.output), { recursive: true })
}

if (!existsSync(config.operations)) {
    mkdirSync(config.operations, { recursive: true })
}

// stage 3: generate pages
function renderIndexPage(result: typeof parseResult) {
    const operations = result.paths ? Object.entries(result.paths).map(([path, pathItem]) => {
    const operations = Object.entries(pathItem).filter(([method]) => ['get', 'post', 'put', 'delete', 'patch'].includes(method))
    if (operations.length === 0) return null

    return `
### ${path}

${operations.map(([method, operation]) => `- [**${method.toUpperCase()}**](/operations/${operation?.operationId || `${method}_${path.replace(/\//g, '_')}`}): ${operation.summary || 'No summary'}`).join('\n')}
`}).filter(Boolean).join('\n') : 'No paths defined'

    const servers = result.servers?.map(server => `- ${server.url} (${server.description || 'No description'})`).join('\n') || 'No servers defined'
    
    return `
# ${result.info?.title || 'API Documentation'} - ${result.info?.version || ''}

${result.info?.description || ''}

## Contact

<a target="_blank" href=${result.info?.contact?.url || '#'}>${result.info?.contact?.name || 'Contact'}</a> /
<a href="mailto:${result.info?.contact?.email || '#'}">${result.info?.contact?.email || 'Email'}</a>

## Servers

\`\`\`
${servers}
\`\`\`

## Operations

${operations}

`
}

function renderOperationPage(operation: ParsedOperation) {
    const parameters = operation.parameters ? operation.parameters.map((param) => `- **${param.name}** (${param.in}): ${param.description || 'No description'}`).join('\n') : 'No parameters defined'

    const requestBody = operation.requestBody ? `- **Content Types**: ${Object.keys(operation.requestBody.content || {}).join(', ')}\n- **Description**: ${operation.requestBody.description || 'No description'}` : 'No request body defined'

    const responses = operation.responses ? Object.entries(operation.responses).map(([status, response]) => `- **${status}**: ${response.description || 'No description'}`).join('\n') : 'No responses defined'

    return `
# ${operation.summary}

${operation.description || 'No description'}

## Parameters

${parameters}

## Request Body

${requestBody}

## Responses

${responses}
`
}

function writeToDisk(fileName: string, content: string) {
    const filePath = join(config.output, fileName)
    writeFileSync(filePath, content, 'utf-8')
    console.log(`[build]: written ${filePath}`)
}

// render pages for each operation
const indexContent = renderIndexPage(parseResult)
writeToDisk('intro.md', indexContent)

Object.entries(parseResult.paths || {}).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
            const fileName = `${operation?.operationId || `${method}_${path.replace(/\//g, '_')}`}.md`
            const fileContent = renderOperationPage(operation)
            const filePath = join(config.operations, fileName)
            writeToDisk(filePath, fileContent)
        }
    })
})

