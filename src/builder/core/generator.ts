import type { GenerateOptions, Operation } from '../types'
import type { OpenAPIDocument } from '@/types'
import slugify from '@sindresorhus/slugify'
import { extractOperations } from './extractor'

function getFileName(op: Operation): string {
  return (
    op.operationId ||
    `${op.method}-${op.path.replace(/[/{}]/g, '-').replace(/-+/g, '-')}`
  )
}

function yamlFrontmatter(data: Record<string, any>): string {
  // Simple YAML‑like frontmatter (no library)
  const lines = Object.entries(data).map(
    ([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`,
  )
  return `---\n${lines.join('\n')}\n---\n`
}

export async function generateAllPages(
  spec: OpenAPIDocument,
  options: GenerateOptions,
): Promise<Record<string, string>> {
  const {
    basePath = '',
    groupBy = true,
    apiBaseUrl = '',
    frontmatter,
  } = options
  const renderers = options.renderers // Already merged

  const operations = extractOperations(spec)

  // Grouping
  let groups: { name: string; operations: Operation[] }[]
  if (groupBy === false) {
    groups = [{ name: '', operations }]
  } else if (typeof groupBy === 'function') {
    const map = new Map<string, Operation[]>()
    for (const op of operations) {
      const name = groupBy(op)
      if (!map.has(name)) {
        map.set(name, [])
      }
      map.get(name)!.push(op)
    }
    groups = Array.from(map.entries(), ([name, ops]) => ({
      name,
      operations: ops,
    }))
  } else {
    // default: first tag
    const map = new Map<string, Operation[]>()
    for (const op of operations) {
      const tag = (op.tags && op.tags[0]) || 'Default'
      if (!map.has(tag)) {
        map.set(tag, [])
      }
      map.get(tag)!.push(op)
    }
    groups = Array.from(map.entries(), ([name, ops]) => ({
      name,
      operations: ops,
    }))
  }

  const pages: Record<string, string> = {}

  // Index page
  pages['index.md'] = renderers
    ? (renderers.indexPageLayout?.(groups, spec, basePath, renderers) ?? '')
    : ''
  function buildSections(op: Operation): string[] {
    const sections: string[] = []
    sections.push(renderers?.operationHeader?.(op) ?? '')
    sections.push(renderers?.parameters?.(op.parameters, op, renderers) ?? '')
    if (op.requestBody) {
      sections.push(
        renderers?.requestBody?.(op.requestBody, op, renderers) ?? '',
      )
    }
    sections.push(renderers?.responses?.(op.responses, op, renderers) ?? '')
    sections.push(renderers?.tryItOut?.(op, spec, apiBaseUrl) ?? '')
    if (op.security && op.security.length) {
      sections.push(renderers?.security?.(op.security, spec) ?? '')
    }
    if (op.deprecated) {
      sections.push(renderers?.deprecationNotice?.(op) ?? '')
    }
    return sections
  }

  for (const group of groups) {
    const groupDir = group.name
      ? slugify(group.name, { decamelize: false })
      : ''
    for (const op of group.operations) {
      const fileName = getFileName(op)
      const pagePath = groupDir
        ? `${groupDir}/${fileName}.md`
        : `${fileName}.md`
      const sections = buildSections(op)
      let content = renderers?.pageLayout?.(sections, op) ?? ''
      if (frontmatter) {
        const fm = frontmatter(op)
        if (fm && Object.keys(fm).length) {
          content = `${yamlFrontmatter(fm)}\n${content}`
        }
      }
      pages[pagePath] = content
    }
  }

  return pages
}

export async function writeOutput(
  pages: Record<string, string>,
  outputDir: string,
): Promise<void> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  await fs.mkdir(outputDir, { recursive: true })
  for (const [filePath, content] of Object.entries(pages)) {
    const fullPath = path.join(outputDir, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
  }
}
