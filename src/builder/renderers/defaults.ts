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

type FullRenderers = Required<Renderers>

function renderParamTable(params: NormalizedParameter[]): string {
  if (!params.length) {
    return ''
  }
  let md =
    '| Name | In | Required | Description | Schema | Example |\n|------|----|----------|-------------|--------|----------|\n'
  for (const p of params) {
    const schemaStr = p.schema
      ? `\`${JSON.stringify(p.schema).substring(0, 50)}...\``
      : '-'
    const exampleStr = p.example ? `\`${JSON.stringify(p.example)}\`` : '-'
    md += `| ${p.name} | ${p.in} | ${p.required ? 'Yes' : 'No'} | ${p.description || '-'} | ${schemaStr} | ${exampleStr} |\n`
  }
  return `${md}\n`
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
  let md = `### ${statusText} ${response.description ? `- ${response.description}` : ''}\n\n`
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
      let md = `# \`${op.method.toUpperCase()}\` ${op.path} ${op.deprecated ? '~~(deprecated)~~' : ''}\n\n`
      if (op.summary) {
        md += `**Summary**: ${op.summary}\n\n`
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
    pathParameters: renderParamTable,
    queryParameters: renderParamTable,
    headerParameters: renderParamTable,
    cookieParameters: renderParamTable,
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
      const opId =
        op.operationId || `${op.method}-${op.path.replace(/\//g, '-')}`
      const config = {
        method: op.method,
        path: op.path,
        parameters: op.parameters,
        requestBody: !!op.requestBody,
        baseUrl: apiBaseUrl,
      }
      const configStr = JSON.stringify(config).replace(/`/g, '\\`')

      return `
<script setup>
import { ref, reactive } from 'vue'

const config = ${configStr}

const method = config.method.toUpperCase()
const base = config.baseUrl || ''
const path = config.path
const params = config.parameters || []
const hasBody = config.requestBody

const pathParams = params.filter(p => p.in === 'path')
const queryParams = params.filter(p => p.in === 'query')
const headerParams = params.filter(p => p.in === 'header')
const formValues = reactive(Object.fromEntries(params.map(p => [p.name, ''])))
const bodyValue = ref('')
const loading = ref(false)
const response = ref(null)
const error = ref(null)

const buildUrl = () => {
  let url = base + path
  pathParams.forEach(p => {
    url = url.replace(\`{\${p.name}}\`, encodeURIComponent(formValues[p.name]))
  })
  const query = queryParams.filter(p => formValues[p.name] !== '').map(p => \`\${encodeURIComponent(p.name)}=\${encodeURIComponent(formValues[p.name])}\`).join('&')
  if (query) url += '?' + query
  return url
}

const sendRequest = async () => {
  loading.value = true
  error.value = null
  response.value = null
  const url = buildUrl()
  const headers = {}
  headerParams.forEach(p => { if (formValues[p.name]) headers[p.name] = formValues[p.name] })
  const fetchOptions = { method, headers }
  if (method !== 'GET' && method !== 'HEAD' && hasBody) {
    if (bodyValue.value) {
      try {
        fetchOptions.body = bodyValue.value
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
      } catch (e) {}
    }
  }
  try {
    const res = await fetch(url, fetchOptions)
    const text = await res.text()
    try {
      response.value = JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      response.value = text
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<div class="try-it-widget">
  <h3>Try It Out</h3>
  <div class="form-grid">
    <div v-for="param in pathParams" :key="param.name" class="form-field">
      <label>{{ param.name }} (path){{ param.required ? '*' : '' }}</label>
      <input v-model="formValues[param.name]" :placeholder="param.description || 'Enter ' + param.name" />
    </div>
    <div v-for="param in queryParams" :key="param.name" class="form-field">
      <label>{{ param.name }} (query){{ param.required ? '*' : '' }}</label>
      <input v-model="formValues[param.name]" :placeholder="param.description || ''" />
    </div>
    <div v-for="param in headerParams" :key="param.name" class="form-field">
      <label>{{ param.name }} (header){{ param.required ? '*' : '' }}</label>
      <input v-model="formValues[param.name]" :placeholder="param.description || ''" />
    </div>
  </div>
  <div v-if="hasBody" class="request-body-field">
    <label>Request Body (JSON)</label>
    <textarea v-model="bodyValue" rows="10" placeholder='{...}'></textarea>
  </div>
  <button @click="sendRequest" :disabled="loading">{{ loading ? 'Sending...' : 'Send' }}</button>
  <div v-if="error" class="error">{{ error }}</div>
  <pre v-if="response" class="response">{{ response }}</pre>
</div>

<style scoped>
.try-it-widget { border: 1px solid #ccc; padding: 1em; margin: 1em 0; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5em; }
.form-field label { display: block; font-weight: bold; }
.form-field input, textarea { width: 100%; padding: 0.5em; }
.error { color: red; margin-top: 1em; }
.response { background: #fafafa; padding: 1em; margin-top: 1em; white-space: pre-wrap; word-break: break-all; }
button { padding: 0.5em 1em; cursor: pointer; }
</style>`
    },
    security: (requirements: SecurityRequirement[], spec: OpenAPIDocument) => {
      if (!requirements.length) {
        return ''
      }
      let md = '## Security\n\n'
      for (const req of requirements) {
        for (const [scheme, scopes] of Object.entries(req)) {
          md += `- **${scheme}**`
          if (scopes.length) {
            md += ` (scopes: ${scopes.join(', ')})`
          }
          md += '\n'
        }
      }
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
