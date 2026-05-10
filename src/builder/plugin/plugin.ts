import type { Plugin } from 'vite'
import type { Renderers } from '../types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseOpenapi } from '@/lib/parser/parseOpenapi'
import { generateAllPages, writeOutput } from '../core/index'
import { createRenderers } from '../renderers/index'

export interface VitePressPluginOptions {
  specPath: string
  outputDir?: string
  basePath?: string
  groupBy?: ((operation: any) => string) | boolean
  renderers?: Partial<Renderers>
  apiBaseUrl?: string
  frontmatter?: (operation: any) => Record<string, any>
  srcDir?: string
}

export function openapiDocsPlugin(options: VitePressPluginOptions): Plugin {
  const {
    specPath,
    outputDir = 'api',
    basePath = '.',
    groupBy = true,
    renderers: customRenderers,
    apiBaseUrl = '/',
    frontmatter,
    srcDir: userSrcDir,
  } = options

  let resolvedRoot: string = '.'
  let resolvedSrcDir: string = '.'

  const generate = async () => {
    const spec = await parseOpenapi().parseAsync({ spec: specPath })
    const renderers = createRenderers(customRenderers)
    const pages = await generateAllPages(spec, {
      basePath,
      groupBy,
      renderers,
      apiBaseUrl,
      frontmatter,
    })
    const out = path.resolve(resolvedSrcDir, outputDir)
    await fs.rm(out, { recursive: true, force: true })
    await writeOutput(pages, out)
  }

  return {
    name: 'vitepress-plugin-openapi',
    configResolved(config) {
      resolvedRoot = config.root
      const vitepressConfig = (config as any).vitepress
      resolvedSrcDir = userSrcDir
        ? path.resolve(resolvedRoot, userSrcDir)
        : vitepressConfig?.srcDir
          ? path.resolve(resolvedRoot, vitepressConfig.srcDir)
          : resolvedRoot
    },
    async buildStart() {
      await generate()
    },
    configureServer(server) {
      const specFullPath = path.resolve(resolvedRoot, specPath)
      server.watcher.add(specFullPath)
      server.watcher.on('change', async (changedPath) => {
        if (changedPath === specFullPath) {
          console.warn('spec changed, regenerating...')
          await generate()
        }
      })
    },
  }
}
