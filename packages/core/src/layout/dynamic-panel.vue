<template>
  <!-- 暂时只传递自定义属性，屏蔽 dockview api 相关 -->
  <component :is="resolvedComponent" v-bind="endpoint.params.componentProps" />
</template>

<script setup lang="ts">
import { inject, computed, type Component, type ShallowRef } from 'vue'
import type { ComponentRegistry } from './componentRegistry'
import { IDockviewPanelProps } from 'dockview-vue'

// dockview-vue 类型帮助函数（dockview bug 导致 props 类型存在额外的一层嵌套，需解构出来使用，临时屏蔽 ts 规则）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUserParams<T>(dockviewParams: any): T {
  return dockviewParams?.params as T
}

interface PanelProperties {
  componentName: string
  panelId?: string
  componentProps?: Record<string, unknown>
}
const props = defineProps<IDockviewPanelProps<PanelProperties>>()
const endpoint = extractUserParams<IDockviewPanelProps<PanelProperties>>(props)

// 从上层注入 ComponentRegistry 实例
const componentRegistry =
  inject<ShallowRef<ComponentRegistry>>('componentRegistry')

// 计算属性，当 componentName prop 变化时，自动从注册表里查找组件
const resolvedComponent = computed<Component | null>(() => {
  if (!componentRegistry?.value) {
    console.error('ComponentRegistry not provided!')
    return null
  }
  const component = componentRegistry.value.getComponent(
    endpoint.params.componentName
  )
  if (!component) {
    console.error(
      `Component "${endpoint.params.componentName}" not found in registry.`
    )
    return null
  }
  return component
})
</script>
