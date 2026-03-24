<script setup>
import { destr } from 'destr'
import { computed } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import { useTheme } from '../../../composables/useTheme'
import 'vue-json-pretty/lib/styles.css'
import OALazy from '../Lazy/OALazy.vue'

const props = defineProps({
  code: {
    type: [String, Object, Array, Number, Boolean],
    required: true,
  },
  deep: {
    type: Number,
  },
})

const themeConfig = useTheme()

const isDark = themeConfig.isDark

const json = computed(() => {
  return typeof props.code === 'string' ? destr(props.code) : props.code
})

const deep = computed(() => {
  return props.deep ?? themeConfig.getJsonViewerDeep() ?? 3
})

const theme = computed(() => {
  return isDark.value ? 'dark' : 'light'
})
</script>

<template>
  <OALazy>
    <VueJsonPretty
      :data="json"
      :theme="theme"
      :deep="deep"
      show-icon
      class="p-2"
    />
  </OALazy>
</template>
