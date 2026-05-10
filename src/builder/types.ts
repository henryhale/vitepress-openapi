import type { OpenAPIDocument } from '@/types'

export interface NormalizedParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required: boolean
  description?: string
  schema?: any
  example?: any
  extensions?: Record<string, any>
}

export interface MediaObject {
  schema?: any
  example?: any
  examples?: Record<
    string,
    { value: any; summary?: string; description?: string }
  >
}

export interface RequestBody {
  description?: string
  required?: boolean
  content: Record<string, MediaObject>
}

export interface ResponseObject {
  description: string
  content?: Record<string, MediaObject>
  headers?: Record<string, any>
}

export interface SecurityRequirement {
  [key: string]: string[]
}

export interface Operation {
  method: string
  path: string
  operationId?: string
  summary?: string
  description?: string
  deprecated?: boolean
  tags?: string[]
  parameters: NormalizedParameter[]
  requestBody?: RequestBody
  responses: Record<string, ResponseObject>
  security?: SecurityRequirement[]
  extensions: Record<string, any>
}

export interface Renderers {
  operationHeader?: (operation: Operation) => string
  parameters?: (
    parameters: NormalizedParameter[],
    operation: Operation,
    renderers?: Renderers,
  ) => string
  pathParameters?: (
    params: NormalizedParameter[],
    operation: Operation,
  ) => string
  queryParameters?: (
    params: NormalizedParameter[],
    operation: Operation,
  ) => string
  headerParameters?: (
    params: NormalizedParameter[],
    operation: Operation,
  ) => string
  cookieParameters?: (
    params: NormalizedParameter[],
    operation: Operation,
  ) => string
  requestBody?: (
    requestBody: RequestBody,
    operation: Operation,
    renderers?: Renderers,
  ) => string
  requestBodyContent?: (
    mediaType: string,
    mediaObject: MediaObject,
    operation: Operation,
    renderers?: Renderers,
  ) => string
  responses?: (
    responses: Record<string, ResponseObject>,
    operation: Operation,
    renderers?: Renderers,
  ) => string
  responseDetail?: (
    statusCode: string,
    response: ResponseObject,
    operation: Operation,
    renderers?: Renderers,
  ) => string
  schema?: (schema: any, title?: string, context?: any) => string
  example?: (
    exampleValue: any,
    mediaType?: string,
    title?: string,
    context?: any,
  ) => string
  tryItOut?: (
    operation: Operation,
    spec: OpenAPIDocument,
    apiBaseUrl?: string,
  ) => string
  security?: (
    securityRequirements: SecurityRequirement[],
    spec: OpenAPIDocument,
  ) => string
  deprecationNotice?: (operation: Operation) => string
  pageLayout?: (sections: string[], operation: Operation) => string
  indexPageLayout?: (
    groups: { name: string; operations: Operation[] }[],
    spec: OpenAPIDocument,
    basePath?: string,
    renderers?: Renderers,
  ) => string
  indexOperationLink?: (
    operation: Operation,
    groupDir: string,
    fileName: string,
    basePath?: string,
  ) => string
}

export interface GenerateOptions {
  basePath?: string
  groupBy?: ((operation: Operation) => string) | boolean
  renderers: Renderers
  apiBaseUrl?: string
  frontmatter?: (operation: Operation) => Record<string, any>
}
