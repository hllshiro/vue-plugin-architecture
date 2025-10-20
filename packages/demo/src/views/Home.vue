<template>
  <div class="home">
    <h2>{{ t('home.title') }}</h2>

    <div class="controls-panel">
      <div class="control-group">
        <span class="control-label">{{
          t('home.languageSelector.label')
        }}</span>
        <div class="button-group">
          <button
            v-for="lang in languages"
            :key="lang.value"
            class="control-btn"
            :class="{ active: selectedLanguage === lang.value }"
            @click="switchLanguage(lang.value)"
          >
            {{ lang.label }}
          </button>
        </div>
      </div>

      <div class="control-group">
        <span class="control-label">{{ t('home.themeSelector.label') }}</span>
        <div class="button-group theme-buttons">
          <button
            v-for="(theme, index) in themeConfig"
            :key="theme.className"
            class="control-btn theme-btn"
            :class="{ active: selectedTheme === index }"
            @click="switchTheme(index)"
          >
            {{ theme.name }}
          </button>
        </div>
      </div>
    </div>

    <div class="intro">
      <p>{{ t('home.intro.description') }}</p>
      <p>{{ t('home.intro.features') }}</p>
      <ul>
        <li>{{ t('home.intro.featureList.dynamicLoading') }}</li>
        <li>{{ t('home.intro.featureList.dockviewIntegration') }}</li>
        <li>{{ t('home.intro.featureList.communication') }}</li>
        <li>{{ t('home.intro.featureList.devTools') }}</li>
        <li>{{ t('home.intro.featureList.typeSafety') }}</li>
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
import { inject, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

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
const selectedLanguage = ref(locale.value)

// 语言选项
const languages = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]

// 主题配置（包含所有主题的名称映射）
const themeConfig = computed(() => [
  { name: t('home.themes.light'), className: 'light' },
  { name: t('home.themes.dark'), className: 'dark' },
  { name: t('home.themes.abyss'), className: 'abyss' },
  { name: t('home.themes.abyssSpaced'), className: 'abyss-spaced' },
  { name: t('home.themes.lightSpaced'), className: 'light-spaced' },
  { name: t('home.themes.dracula'), className: 'dracula' },
  { name: t('home.themes.replit'), className: 'replit' },
  { name: t('home.themes.visualStudio'), className: 'visual-studio' },
])

const switchLanguage = (lang: string) => {
  selectedLanguage.value = lang
  locale.value = lang
}

const switchTheme = (themeIndex: number) => {
  selectedTheme.value = themeIndex
  if (changeTheme) {
    changeTheme(themes[themeIndex])
  }
}
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
  background-color: var(--dv-group-view-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  height: 100%;
}

.controls-panel {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background-color: var(--dv-tabs-and-actions-container-background-color);
  border: 1px solid var(--dv-separator-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.control-group {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.control-label {
  font-weight: 500;
  color: var(--dv-activegroup-visiblepanel-tab-color);
  min-width: 80px;
  font-size: 0.9rem;
  flex-shrink: 0;
  padding-top: 0.4rem;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: nowrap;
}

.button-group.theme-buttons {
  flex-wrap: wrap;
  gap: 0.4rem;
  max-width: 500px;
}

.control-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--dv-separator-border);
  border-radius: 6px;
  background-color: var(--dv-group-view-background-color);
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 400;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-align: center;
}

.control-btn.theme-btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  min-width: auto;
  border-radius: 4px;
}

.control-btn:hover {
  background-color: var(--dv-icon-hover-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
}

.control-btn.active {
  background-color: var(--dv-activegroup-visiblepanel-tab-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  border-color: var(--dv-paneview-active-outline-color);
  font-weight: 500;
}

@media (max-width: 768px) {
  .control-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .control-label {
    min-width: auto;
    padding-top: 0;
  }

  .button-group.theme-buttons {
    max-width: 100%;
  }

  .control-btn.theme-btn {
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
  }
}

@media (max-width: 480px) {
  .controls-panel {
    padding: 1rem;
  }

  .button-group.theme-buttons {
    gap: 0.3rem;
  }

  .control-btn.theme-btn {
    font-size: 0.7rem;
    padding: 0.3rem 0.5rem;
  }
}

.intro {
  background-color: var(--dv-inactivegroup-visiblepanel-tab-background-color);
  padding: 2rem;
  border-radius: 8px;
  margin: 2rem 0;
  border: 1px solid var(--dv-separator-border);
}

.intro ul {
  margin: 1rem 0;
  padding-left: 2rem;
}

.intro li {
  margin: 0.5rem 0;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}
</style>
