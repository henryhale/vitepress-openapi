import type {
  MediaObject,
  NormalizedParameter,
  Operation,
  RequestBody,
  ResponseObject,
  SecurityRequirement,
} from '../types'
import type { OpenAPIDocument } from '@/types'

export function extractOperations(spec: OpenAPIDocument): Operation[] {
  const ops: Operation[] = []
  if (!spec.paths) {
    return ops
  }

  const version = (spec as any).swagger ? 2 : 3
  const securityGlobal = (spec as any).security || []

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) {
      continue
    }
    const methods = [
      'get',
      'put',
      'post',
      'delete',
      'patch',
      'options',
      'head',
      'trace',
    ]
    for (const method of methods) {
      const operation = (pathItem as any)[method]
      if (!operation) {
        continue
      }

      // combine path-level and operation-level parameters
      const pathParams: any[] = (pathItem as any).parameters || []
      const opParams: any[] = operation.parameters || []
      const mergedParams = mergeParameters(pathParams, opParams)

      const parameters: NormalizedParameter[] = mergedParams
        .filter((p) => p.in !== 'body' && p.in !== 'formData') // body handled separately
        .map((p) => normalizeParam(p, version))

      // requestBody
      let requestBody: RequestBody | undefined
      if (version === 3 && operation.requestBody) {
        requestBody = normalizeRequestBodyV3(operation.requestBody)
      } else if (version === 2) {
        const bodyParam = mergedParams.find((p) => p.in === 'body')
        if (bodyParam) {
          const contentType =
            operation.consumes?.[0] ||
            (spec as any).consumes?.[0] ||
            'application/json'
          requestBody = {
            description: bodyParam.description,
            required: bodyParam.required,
            content: {
              [contentType]: {
                schema: bodyParam.schema,
              },
            },
          }
        }
      }

      // responses
      const responses: Record<string, ResponseObject> = {}
      if (operation.responses) {
        for (const [code, resp] of Object.entries(operation.responses)) {
          responses[code] = normalizeResponse(resp as any, version)
        }
      }

      // security
      const security: SecurityRequirement[] | undefined =
        operation.security || securityGlobal

      // x-* extensions
      const extensions: Record<string, any> = {}
      Object.keys(operation)
        .filter((k) => k.startsWith('x-'))
        .forEach((k) => (extensions[k] = operation[k]))

      ops.push({
        method,
        path,
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        deprecated: operation.deprecated ?? false,
        tags: operation.tags,
        parameters,
        requestBody,
        responses,
        security,
        extensions,
      })
    }
  }
  return ops
}

function mergeParameters(pathParams: any[], opParams: any[]): any[] {
  const map = new Map<string, any>()
  for (const p of [...pathParams, ...opParams]) {
    const key = `${p.name}:${p.in}`
    map.set(key, p)
  }
  return [...map.values()]
}

function normalizeParam(param: any, version: number): NormalizedParameter {
  const extensions: Record<string, any> = {}
  Object.keys(param)
    .filter((k) => k.startsWith('x-'))
    .forEach((k) => (extensions[k] = param[k]))

  if (version === 3) {
    return {
      name: param.name,
      in: param.in,
      required: !!param.required,
      description: param.description,
      schema: param.schema,
      example: param.example || param.schema?.example,
      extensions,
    }
  } else {
    // Swagger 2.0
    const schema = buildSchemaFromSwaggerParam(param)
    return {
      name: param.name,
      in: param.in,
      required: !!param.required,
      description: param.description,
      schema,
      example: param['x-example'],
      extensions,
    }
  }
}

function buildSchemaFromSwaggerParam(param: any): any {
  if (param.schema) {
    return param.schema
  }
  const s: any = {}
  if (param.type) {
    s.type = param.type
  }
  if (param.format) {
    s.format = param.format
  }
  if (param.items) {
    if (param.type === 'array') {
      s.items = buildSchemaFromSwaggerParam(param.items)
    } else {
      s.items = param.items
    }
  }
  if (param.enum) {
    s.enum = param.enum
  }
  if (param.default !== undefined) {
    s.default = param.default
  }
  return s
}

function normalizeRequestBodyV3(rb: any): RequestBody {
  const content: Record<string, MediaObject> = {}
  for (const [mediaType, mediaObj] of Object.entries(rb.content || {})) {
    const m = mediaObj as any
    content[mediaType] = {
      schema: m.schema,
      example: m.example,
      examples: m.examples,
    }
  }
  return {
    description: rb.description,
    required: rb.required,
    content,
  }
}

function normalizeResponse(r: any, version: number): ResponseObject {
  const content: Record<string, MediaObject> = {}
  if (version === 3 && r.content) {
    for (const [mt, obj] of Object.entries(r.content)) {
      const m = obj as any
      content[mt] = {
        schema: m.schema,
        example: m.example,
        examples: m.examples,
      }
    }
  } else if (version === 2 && r.schema) {
    content['application/json'] = { schema: r.schema }
  }
  return {
    description: r.description,
    content: Object.keys(content).length ? content : undefined,
    headers: r.headers,
  }
}
