import type {
  MediaObject,
  NormalizedParameter,
  Operation,
  Renderers,
  RequestBody,
  ResponseObject,
  SecurityRequirement,
} from '../types'
import type { OpenAPIDocument } from '@/types'
import slugify from '@sindresorhus/slugify'
import markdownit from 'markdown-it'
import { titleCase } from 'scule'
import { formatValueForDisplay } from '@/lib/format/formatValueForDisplay'
import { getConstraints } from '@/lib/parser/constraintsParser'
import { getSecurityUi } from '@/lib/parser/getSecurityUi'

type FullRenderers = Required<Renderers>

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getOperationId(op: Operation): string {
  return (
    op.operationId ||
    `${op.method}-${op.path.replace(/[/{}]/g, '-').replace(/-+/g, '-')}`
  )
}

function resolveServers(
  spec: OpenAPIDocument,
  op: Operation,
  apiBaseUrl: string,
): { url: string }[] {
  const specAny = spec as any
  const pathItem = specAny?.paths?.[op.path] || {}
  const opItem = pathItem?.[op.method] || {}
  const servers = opItem?.servers || pathItem?.servers || specAny?.servers || []

  if (servers.length) {
    return servers
  }

  return apiBaseUrl ? [{ url: apiBaseUrl }] : []
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function formatSchemaSummary(schema?: any): string {
  if (!schema) {
    return '-'
  }
  const parts: string[] = []
  if (schema.type) {
    parts.push(schema.type)
  }
  if (schema.format) {
    parts.push(schema.format)
  }
  if (schema.items?.type) {
    parts.push(`items: ${schema.items.type}`)
  }
  if (schema.enum) {
    const values = Array.isArray(schema.enum)
      ? schema.enum.map((v: any) => JSON.stringify(v)).join(', ')
      : String(schema.enum)
    parts.push(`enum: ${values}`)
  }
  if (!parts.length) {
    return `\`${JSON.stringify(schema)}\``
  }
  return `\`${parts.join(', ')}\``
}

function formatExampleSummary(example?: any): string {
  if (example === undefined) {
    return '-'
  }
  const value = typeof example === 'string' ? example : JSON.stringify(example)
  return `\`${value}\``
}

function renderParamTable(params: NormalizedParameter[]): string {
  if (!params.length) {
    return ''
  }
  let md =
    '| Name | In | Required | Description | Schema | Example |\n|------|----|----------|-------------|--------|----------|\n'
  for (const p of params) {
    const schemaStr = formatSchemaSummary(p.schema)
    const exampleStr = formatExampleSummary(p.example)
    const description = p.description ? escapeTableCell(p.description) : '-'
    md += `| ${escapeTableCell(p.name)} | ${p.in} | ${p.required ? 'Yes' : 'No'} | ${description} | ${schemaStr} | ${exampleStr} |\n`
  }
  return `${md}\n`
}

function renderParameterGroup(
  title: string,
  params: NormalizedParameter[],
): string {
  if (!params.length) {
    return ''
  }
  return `### ${title}\n\n${renderParamTable(params)}`
}

const defaultSchema = (schema: any, title?: string): string => {
  let md = ''
  if (title) {
    md += `**${title}**\n\n`
  }
  md += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`
  return md
}

const defaultExample = (
  exampleValue: any,
  mediaType?: string,
  title?: string,
): string => {
  let md = ''
  if (title) {
    md += `**${title}**\n\n`
  }
  const val =
    typeof exampleValue === 'string'
      ? exampleValue
      : JSON.stringify(exampleValue, null, 2)
  md += `\`\`\`${mediaType?.includes('json') ? 'json' : ''}\n${val}\n\`\`\`\n\n`
  return md
}

const defaultRequestBodyContent = (
  mediaType: string,
  mediaObj: MediaObject,
  op: Operation,
  r: FullRenderers,
): string => {
  let md = `### ${mediaType}\n\n`
  if (mediaObj.schema) {
    md += r.schema(mediaObj.schema, 'Schema')
  }
  if (mediaObj.example) {
    md += r.example(mediaObj.example, mediaType, 'Example')
  }
  if (mediaObj.examples) {
    for (const [name, ex] of Object.entries(mediaObj.examples)) {
      md += `#### ${name}\n\n`
      if (ex.summary) {
        md += `${ex.summary}\n\n`
      }
      if (ex.description) {
        md += `${ex.description}\n\n`
      }
      md += r.example(ex.value, mediaType, 'Example')
    }
  }
  return md
}

const defaultResponseDetail = (
  statusCode: string,
  response: ResponseObject,
  op: Operation,
  r: FullRenderers,
): string => {
  const statusText = statusCode === 'default' ? 'Default' : statusCode
  let md = `### ${statusText}\n\n`
  if (response.description) {
    md += `${response.description}\n\n`
  }
  if (response.content) {
    for (const [mediaType, mediaObj] of Object.entries(response.content)) {
      md += r.requestBodyContent(mediaType, mediaObj, op, r)
    }
  }
  return md
}

export function createDefaultRenderers(): FullRenderers {
  const r: FullRenderers = {
    operationHeader: (op: Operation) => {
      const title =
        op.summary || op.operationId || `${op.method.toUpperCase()} ${op.path}`
      let md = `# ${title}\n\n`
      md += `\`${op.method.toUpperCase()}\` ${op.path}\n\n`
      if (op.operationId) {
        md += `**Operation ID**: \`${op.operationId}\`\n\n`
      }
      if (op.description) {
        md += `${op.description}\n\n`
      }
      return md
    },
    parameters: (
      params: NormalizedParameter[],
      op: Operation,
      renderers?: FullRenderers,
    ) => {
      if (!params.length) {
        return ''
      }
      const groups: Record<string, NormalizedParameter[]> = {}
      for (const p of params) {
        ;(groups[p.in] = groups[p.in] || []).push(p)
      }
      let md = '## Parameters\n\n'
      const ren = renderers || r
      for (const [loc, group] of Object.entries(groups)) {
        const handler = (ren as any)[`${loc}Parameters`] || renderParamTable
        md += `${handler(group, op)}\n`
      }
      return md
    },
    pathParameters: (params: NormalizedParameter[]) =>
      renderParameterGroup('Path Parameters', params),
    queryParameters: (params: NormalizedParameter[]) =>
      renderParameterGroup('Query Parameters', params),
    headerParameters: (params: NormalizedParameter[]) =>
      renderParameterGroup('Header Parameters', params),
    cookieParameters: (params: NormalizedParameter[]) =>
      renderParameterGroup('Cookie Parameters', params),
    requestBody: (
      body: RequestBody,
      op: Operation,
      renderers?: FullRenderers,
    ) => {
      let md = '## Request Body\n\n'
      if (body.description) {
        md += `${body.description}\n\n`
      }
      if (body.required !== undefined) {
        md += body.required ? '**Required**\n\n' : '**Optional**\n\n'
      }
      if (!body.content || !Object.keys(body.content).length) {
        return md
      }
      const ren = renderers || r
      for (const [mediaType, mediaObj] of Object.entries(body.content)) {
        md += `${ren.requestBodyContent(mediaType, mediaObj, op, ren)}\n`
      }
      return md
    },
    requestBodyContent: defaultRequestBodyContent,
    responses: (
      responses: Record<string, ResponseObject>,
      op: Operation,
      renderers?: FullRenderers,
    ) => {
      let md = '## Responses\n\n'
      const ren = renderers || r
      for (const [status, resp] of Object.entries(responses)) {
        md += `${ren.responseDetail(status, resp, op, ren)}\n`
      }
      return md
    },
    responseDetail: defaultResponseDetail,
    schema: defaultSchema,
    example: defaultExample,
    tryItOut: (
      op: Operation,
      spec: OpenAPIDocument,
      apiBaseUrl: string = '',
    ) => {
      const securityUi = getSecurityUi(
        (op.security ?? (spec as any).security ?? []) as any,
        (spec as any).components?.securitySchemes ?? {},
      )
      const data = {
        operationId: getOperationId(op),
        path: op.path,
        method: op.method,
        servers: resolveServers(spec, op, apiBaseUrl),
        parameters: op.parameters,
        requestBody: op.requestBody,
        securityUi,
      }
      const dataStr = escapeHtmlAttribute(JSON.stringify(data))
      return `<OAPlayground data="${dataStr}" />`
    },
    security: (requirements: SecurityRequirement[], spec: OpenAPIDocument) => {
      if (!requirements.length) {
        return ''
      }
      const securityUi = getSecurityUi(
        requirements as any,
        (spec as any).components?.securitySchemes ?? {},
      )
      if (!securityUi.length) {
        return ''
      }

      const formatType = (scheme: any): string => {
        if (scheme.type === 'http') {
          return `HTTP (${scheme.scheme})`
        }
        if (scheme.type === 'apiKey') {
          return `API Key (${scheme.in}: ${scheme.name})`
        }
        if (scheme.type === 'openIdConnect') {
          return `OpenID Connect (${scheme.openIdConnectUrl})`
        }
        if (scheme.type === 'oauth2') {
          return 'OAuth2'
        }
        return ''
      }

      let md = '## Authorizations\n\n'
      securityUi.forEach((item, index) => {
        if (
          item.id &&
          (securityUi.length > 1 || Object.keys(item.schemes).length > 1)
        ) {
          md += `### ${item.id}\n\n`
        }

        for (const [schemeName, scheme] of Object.entries(item.schemes)) {
          md += `- **${schemeName}**\n`
          if (scheme.description) {
            md += `  - ${scheme.description}\n`
          }
          const typeValue = formatType(scheme)
          if (typeValue) {
            md += `  - Type: ${typeValue}\n`
          }

          if (scheme.type === 'oauth2' && scheme.flows) {
            for (const [flow, flowDetails] of Object.entries(scheme.flows)) {
              md += `  - ${flow} flow:\n`
              const details = flowDetails as any
              if (details.authorizationUrl) {
                md += `    - Authorization URL: ${details.authorizationUrl}\n`
              }
              if (details.tokenUrl) {
                md += `    - Token URL: ${details.tokenUrl}\n`
              }
              if (details.scopes && Object.keys(details.scopes).length) {
                md += `    - Scopes:\n`
                for (const [scope, desc] of Object.entries(details.scopes)) {
                  md += `      - \`${scope}\`: ${desc}\n`
                }
              }
            }
          }
        }

        if (index < securityUi.length - 1) {
          md += '\n**or**\n\n'
        } else {
          md += '\n'
        }
      })

      return md
    },
    deprecationNotice: (op: Operation) => '> ⚠️ **Deprecated**\n\n',
    pageLayout: (sections: string[], operation: Operation) =>
      sections.filter((s) => s.trim()).join('\n\n'),
    indexPageLayout: (
      groups: { name: string; operations: Operation[] }[],
      spec: OpenAPIDocument,
      basePath: string = '',
      renderers?: FullRenderers,
    ) => {
      let md = '# API Reference\n\n'
      const ren = renderers || r
      for (const group of groups) {
        if (group.name) {
          md += `## ${group.name}\n\n`
        }
        const groupDir = group.name ? slugify(group.name) : ''
        for (const op of group.operations) {
          const fileName = getFileName(op)
          md += `${ren.indexOperationLink(op, groupDir, fileName, basePath)}\n`
        }
        md += '\n'
      }
      return md
    },
    indexOperationLink: (
      op: Operation,
      groupDir: string,
      fileName: string,
      basePath: string = '',
    ) => {
      const label =
        op.summary || op.operationId || `${op.method.toUpperCase()} ${op.path}`
      const linkPath = groupDir ? `${groupDir}/${fileName}` : fileName
      const fullPath = basePath
        ? `${basePath.replace(/\/$/, '')}/${linkPath}`
        : linkPath
      return `- [${label}](/${fullPath})`
    },
  }
  return r
}
