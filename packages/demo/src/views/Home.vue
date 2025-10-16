<template>
  <div class="home">
    <h2>欢迎使用 Vue 插件架构系统</h2>

    <div class="theme-selector">
      <label for="theme-select">切换主题：</label>
      <select id="theme-select" v-model="selectedTheme" @change="onThemeChange">
        <option v-for="(theme, index) in themes" :key="index" :value="index">
          {{ getThemeName(theme) }}
        </option>
      </select>
    </div>

    <div class="intro">
      <p>这是一个基于 Vue 3 + TypeScript + Vite 的插件化架构系统演示应用。</p>
      <p>系统特性：</p>
      <ul>
        <li>动态插件加载和卸载</li>
        <li>Dockview 面板集成</li>
        <li>插件间双向通信</li>
        <li>完整的开发工具链支持</li>
        <li>TypeScript 类型安全</li>
      </ul>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  themeLight,
  themeDark,
  themeAbyss,
  themeAbyssSpaced,
  themeLightSpaced,
  themeDracula,
  themeReplit,
  themeVisualStudio,
  DockviewTheme,
} from 'dockview-vue'
import { inject, ref } from 'vue'

const themes: DockviewTheme[] = [
  themeLight,
  themeDark,
  themeAbyss,
  themeAbyssSpaced,
  themeLightSpaced,
  themeDracula,
  themeReplit,
  themeVisualStudio,
]

const changeTheme = inject<(t: DockviewTheme) => void>('changeTheme')
const selectedTheme = ref(0)

const getThemeName = (theme: DockviewTheme): string => {
  const themeNames = [
    'Light',
    'Dark',
    'Abyss',
    'Abyss Spaced',
    'Light Spaced',
    'Dracula',
    'Replit',
    'Visual Studio',
  ]
  const index = themes.indexOf(theme)
  return themeNames[index] || 'Unknown'
}

const onThemeChange = () => {
  if (changeTheme) {
    changeTheme(themes[selectedTheme.value])
  }
}
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
}

.theme-selector {
  margin: 1rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 6px;
}

.theme-selector label {
  display: inline-block;
  margin-right: 0.5rem;
  font-weight: 500;
}

.theme-selector select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  min-width: 150px;
}

.intro {
  background: #f9f9f9;
  padding: 2rem;
  border-radius: 8px;
  margin: 2rem 0;
}

.intro ul {
  margin: 1rem 0;
  padding-left: 2rem;
}

.intro li {
  margin: 0.5rem 0;
}

.actions {
  text-align: center;
  margin: 2rem 0;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #007acc;
  color: white;
}

.btn-primary:hover {
  background: #005a9e;
  transform: translateY(-1px);
}
</style>
