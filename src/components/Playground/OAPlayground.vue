<script setup lang="ts">
import type { OpenAPIV3 } from "@scalar/openapi-types";
import type { OperationData } from "@/lib/operation/operationData";
import type { ParsedOperation, SecurityUi } from "@/types";
import { useI18n } from "@byjohann/vue-i18n";
import { computed, inject, onBeforeUnmount, provide } from "vue";
import {
  initOperationData,
  OPERATION_DATA_KEY,
} from "@/lib/operation/operationData";
import { usePlayground } from "../../composables/usePlayground";
import { useTheme } from "../../composables/useTheme";
import { OAHeading } from "../index";
import { Button } from "../ui/button";
import OAPlaygroundParameters from "./OAPlaygroundParameters.vue";
import OAPlaygroundResponse from "./OAPlaygroundResponse.vue";

type PlaygroundData = {
  operationId?: string;
  path?: string;
  method?: string;
  hideEndpoint?: boolean;
  servers?: OpenAPIV3.ServerObject[];
  parameters?: OpenAPIV3.ParameterObject[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  securityUi?: SecurityUi;
  headingPrefix?: string;
};

const props = defineProps({
  data: {
    type: [String, Object],
    required: false,
    default: null,
  },
  operationId: {
    type: String,
    required: false,
    default: "",
  },
  path: {
    type: String,
    required: false,
    default: "",
  },
  method: {
    type: String,
    required: false,
    default: "",
  },
  hideEndpoint: {
    type: Boolean,
    default: false,
  },
  servers: {
    type: Array,
    default: () => [],
  },
  parameters: {
    type: Array<OpenAPIV3.ParameterObject>,
    required: false,
    default: () => [],
  },
  requestBody: {
    type: Object,
    required: false,
    default: undefined,
  },
  securityUi: {
    type: Object,
    required: false,
    default: () => [] as SecurityUi,
  },
  headingPrefix: {
    type: String,
    required: false,
    default: "",
  },
});

function parseData(value: unknown): PlaygroundData | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as PlaygroundData;
    } catch {
      return null;
    }
  }
  return value as PlaygroundData;
}

const parsedData = parseData(props.data);

const resolved = computed(() => {
  const data = parsedData ?? {};
  return {
    operationId: data.operationId ?? props.operationId ?? "",
    path: data.path ?? props.path ?? "",
    method: data.method ?? props.method ?? "",
    hideEndpoint: data.hideEndpoint ?? props.hideEndpoint ?? false,
    servers: (data.servers ?? props.servers ?? []) as OpenAPIV3.ServerObject[],
    parameters: (data.parameters ??
      props.parameters ??
      []) as OpenAPIV3.ParameterObject[],
    requestBody: (data.requestBody ?? props.requestBody) as
      | OpenAPIV3.RequestBodyObject
      | undefined,
    securityUi: (data.securityUi ?? props.securityUi ?? []) as SecurityUi,
    headingPrefix: data.headingPrefix ?? props.headingPrefix ?? "",
  };
});

const operationId = computed(() => {
  if (resolved.value.operationId) {
    return resolved.value.operationId;
  }
  if (resolved.value.method && resolved.value.path) {
    return `${resolved.value.method}-${resolved.value.path.replace(/[/{}]/g, "-")}`;
  }
  return "";
});

const injectedOperationData = inject<OperationData | null>(
  OPERATION_DATA_KEY,
  null,
);

const defaultRequestContentType = Object.keys(
  resolved.value.requestBody?.content ?? {},
)[0];
const defaultServerUrl = resolved.value.servers?.[0]?.url ?? "";

const localOperationData = parsedData
  ? initOperationData({
      operation: {
        operationId: operationId.value,
        securityUi: resolved.value.securityUi,
        requestBody: (resolved.value.requestBody ?? { content: {} }) as any,
        responses: {} as any,
      } as ParsedOperation,
      selectedServer: defaultServerUrl,
      defaultRequestContentType,
    })
  : null;

if (localOperationData) {
  provide(OPERATION_DATA_KEY, localOperationData);
}

const operationData = localOperationData ?? injectedOperationData;

const { loading, response, submitRequest, cleanupImageUrls } = usePlayground();

const { t } = useI18n();

const hasBody = computed(() => Boolean(resolved.value.requestBody));

const hasSecuritySchemes = computed(() => {
  const ui = resolved.value.securityUi ?? [];
  return Array.isArray(ui) ? ui.length > 0 : Object.keys(ui).length > 0;
});

const hasParameters = computed(() =>
  Boolean(
    resolved.value.parameters?.length ||
    hasBody.value ||
    hasSecuritySchemes.value,
  ),
);

const themeConfig = useTheme();

const operationCols = computed(() => themeConfig.getOperationCols());

const exampleBehavior = computed(() =>
  themeConfig.getPlaygroundExamplesBehavior(),
);

const xExampleBehavior = computed(() =>
  themeConfig.getPlaygroundXExampleBehavior(),
);

const headingPrefix = computed(() => resolved.value.headingPrefix);

const examples = computed(() => {
  const selectedContentTypeValue =
    operationData?.requestBody.selectedContentType.value;

  if (
    !selectedContentTypeValue ||
    !resolved.value.requestBody?.content?.[selectedContentTypeValue]
  ) {
    return {};
  }

  return resolved.value.requestBody?.content?.[selectedContentTypeValue]
    ?.examples;
});

async function onSubmit() {
  if (!operationData?.playground.request.value) {
    return;
  }

  await submitRequest({
    request: operationData.playground.request.value,
    method: resolved.value.method,
    baseUrl: operationData.playground.selectedServer.value,
    path: resolved.value.path,
    operationId: operationId.value,
  });
}

onBeforeUnmount(() => {
  cleanupImageUrls();
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <OAHeading
      level="h2"
      :prefix="headingPrefix"
      class="block"
      :class="{
        'sm:hidden': operationCols === 2,
      }"
    >
      {{ t("Playground") }}
    </OAHeading>

    <OAPlaygroundParameters
      v-if="hasParameters"
      :operation-id="operationId"
      :path="resolved.path"
      :method="resolved.method"
      :servers="resolved.servers"
      :parameters="resolved.parameters"
      :security-ui="resolved.securityUi"
      :examples="examples"
      :example-behavior="exampleBehavior"
      :x-example-behavior="xExampleBehavior"
      :request-body="resolved.requestBody"
      @submit="onSubmit"
    />

    <div class="flex flex-col gap-2">
      <Button variant="primary" @click="onSubmit">
        {{ t("Try it out") }}
      </Button>

      <OAPlaygroundResponse
        v-if="response || loading"
        :response="response"
        :loading="loading"
      />
    </div>
  </div>
</template>
