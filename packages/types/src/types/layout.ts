// 布局和面板管理相关类型定义

import type { Component, AsyncComponentLoader } from 'vue'

// Grid layout data structure
export interface GridLayoutData {
  type: 'branch' | 'leaf'
  orientation?: 'horizontal' | 'vertical'
  size?: number
  children?: GridLayoutData[]
  data?: {
    id: string
    component: string
  }
}

// Panel layout data structure
export interface PanelLayoutData {
  id: string
  component: string
  title?: string
  params?: Record<string, unknown>
  size?: { width: number; height: number }
  position?: { x: number; y: number }
}

// Dockview 布局数据
export interface DockviewLayoutData {
  grid?: GridLayoutData
  panels?: Record<string, PanelLayoutData>
  activePanel?: string
}

// 组件注册信息
export interface ComponentRegistration {
  name: string
  component: Component | AsyncComponentLoader
  isAsync: boolean
  loadedAt?: number
  error?: Error
}

// 组件加载选项
export interface ComponentLoadOptions {
  timeout?: number
  retries?: number
  loadingComponent?: Component
  errorComponent?: Component
  delay?: number
}

// 动态面板属性
export interface DynamicPanelProps {
  componentName: string
  componentProps?: Record<string, unknown>
  panelId?: string
}
