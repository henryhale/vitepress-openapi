import type {ParsedOpenAPI, ParsedOperation} from "@/types"
import type { IDefaultRenderers } from "./render"
import { OpenApiSpecInstance } from ".."

export type ISidebarConfig = {
    specPath: string
    title?: string
}

export interface IConfig {
    specPath: string
    outputDir: string
    indexPage?: string
    title?: string
    renderers?: Partial<IRenderer>
    formatter?:(type: 'page' | 'operation', name: string) => string
}

export type IResolvedConfig = IConfig & Required<IRenderer>

export type IRenderFunctionContext = {
    renderers: IRenderer['renderers']
    spec: OpenApiSpecInstance
    operation?: ParsedOperation
}

export interface IRenderFunction<T = unknown> {
    (ctx: IRenderFunctionContext, options?: T): string;
}

export interface IRenderer {
    renderers: IDefaultRenderers
}
