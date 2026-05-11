import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from 'path'
import type { ParsedOpenAPI, } from '@/types'
import { Plugin } from 'vitepress'
import type { IConfig, IResolvedConfig, IRenderer, ISidebarConfig } from './types'
import { defineRenderers } from './render'
import { parseOpenapi } from "../lib/parser/parseOpenapi"
import { renderIndexPage, renderOperationPage } from "./render/pages"
import { createOpenApiSpec, OpenApiSpecInstance } from "@/lib/spec/createOpenApiSpec"


const pageHeader = `---
sidebar: auto
---\n`

const operationHeader = `---
aside: false
outline: false
title: %s
---\n`

const defaultConfig: Partial<IConfig> = {
    outputDir: './api/',
    indexPage: "index.md",
    formatter: (type, name) => {
        if (type === 'page') {
            return pageHeader
        }
        return operationHeader.replace('%s', name)
    }
}

const specCache = new Map<string, OpenApiSpecInstance>()

function getSpecFromPath(filepath: string): OpenApiSpecInstance | null {
    if (specCache.has(filepath)) {
        return specCache.get(filepath) || null
    }

    const specContent = JSON.parse(readFileSync(filepath, 'utf-8'))

    const { parseSync } = parseOpenapi()

    const parseResult = parseSync({
        spec: specContent,
    })

    const finalResult = createOpenApiSpec({ spec: parseResult }) as OpenApiSpecInstance

    specCache.set(filepath, finalResult)

    return finalResult
}

function writeToDisk(dir: string, fileName: string, content: string) {
    const filePath = join(dir, fileName)
    writeFileSync(filePath, content, 'utf-8')
    console.log(`[build]: output ${filePath}`)
}


export function definePlugin(config: IConfig): Plugin[] {
    const userDefinedRenderers = config.renderers || {}
    const finalConfig: IResolvedConfig = { ...defaultConfig, ...config, ...defineRenderers(userDefinedRenderers) }


    function generate() {
        const operationsDir = join(finalConfig.outputDir, 'operations')

        if (!existsSync(finalConfig.outputDir)) {
            mkdirSync(dirname(finalConfig.outputDir), { recursive: true })
        }

        if (!existsSync(operationsDir)) {
            mkdirSync(operationsDir, { recursive: true })
        }

        // spec
        const spec = getSpecFromPath(finalConfig.specPath)

        if (!spec) {
            console.error(`[build]: failed to read or parse spec at ${finalConfig.specPath}`)
            return
        }

        // index page
        const indexContext = { spec, renderers: finalConfig.renderers }
        const indexPageHead = finalConfig.formatter?.('page', spec.getInfo().info?.title || 'API Documentation') || pageHeader
        const indexPageContent = finalConfig.renderers?.indexPage?.(indexContext) ?? renderIndexPage(indexContext)
        writeToDisk(finalConfig.outputDir, finalConfig?.indexPage ?? 'index.md', indexPageHead + indexPageContent)

        // operation pages
        Object.entries(spec.getPaths() || {}).forEach(([path, pathItem]) => {
            Object.entries(pathItem).forEach(([method, operation]) => {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    const pageContext = { spec, operation, renderers: finalConfig.renderers }
                    const pageTitle = operation?.summary || operation?.operationId || `${method.toUpperCase()} ${path}`
                    const pageHead = finalConfig.formatter?.('operation', pageTitle) || operationHeader.replace('%s', pageTitle)
                    const fileName = `${operation?.operationId || `${method}_${path.replace(/\//g, '_')}`}.md`
                    const fileContent = finalConfig.renderers?.operationPage?.(pageContext) ?? renderOperationPage(pageContext)
                    writeToDisk(operationsDir, fileName, pageHead + fileContent)
                }
            })
        })
    }


    return [
        {
            name: 'vitepress-plugin-openapi:build',
            apply: "build",
            async buildStart() {
                console.log(`[vitepress-plugin-openapi:build]: starting openapi doc generation...`)
                generate()
                console.log(`[vitepress-plugin-openapi:build]: done!`)
            },
        },
        {
            name: 'vitepress-plugin-openapi:serve',
            apply: "serve",
            configureServer(server) {
                server.watcher.on('change', (file) => {
                    if (file === finalConfig.specPath) {
                        console.log(`[vitepress-plugin-openapi:serve]: detected change in spec file, regenerating...`)
                        generate()
                        // hot reload the page to reflect changes
                        server.ws.send({
                            type: 'full-reload',
                        })
                    }
                })
            }
        }
    ]
}

// generate sidebar config for vitepress
export function generateSidebar(config: ISidebarConfig) {

    return
}
