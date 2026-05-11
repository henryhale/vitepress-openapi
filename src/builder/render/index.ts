import {IRenderer} from "../types";
import { renderParameters, renderRequestBody, renderResponses, renderSecurity, renderServers } from "./components";
import { renderIndexPage, renderOperationPage } from "./pages";


const defaultRenderers = {
    indexPage: renderIndexPage,
    operationPage: renderOperationPage,

    parameters: renderParameters,
    requestBody: renderRequestBody,
    responses: renderResponses,
    security: renderSecurity,
    servers: renderServers,
};

export type IDefaultRenderers = typeof defaultRenderers

export function defineRenderers(initial: Partial<IRenderer>): Required<IRenderer> {
    
    return {
        renderers: {
            // pages
            indexPage: initial.renderers?.indexPage ?? renderIndexPage,
            operationPage: initial.renderers?.operationPage ?? renderOperationPage,
            // components
            parameters: initial.renderers?.parameters ?? renderParameters,
            requestBody: initial.renderers?.requestBody ?? renderRequestBody,
            responses: initial.renderers?.responses ?? renderResponses,
            security: initial.renderers?.security ?? renderSecurity,
            servers: initial.renderers?.servers ?? renderServers,

        }
    }
}