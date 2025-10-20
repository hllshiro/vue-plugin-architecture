<template>
  <div class="hello-world-panel">
    <div class="panel-header">
      <h3>{{ t('title') }}</h3>
      <div class="header-controls">
        <span class="version">v{{ version }}</span>
      </div>
    </div>

    <div class="panel-content">
      <!-- Welcome Message -->
      <div class="welcome-section">
        <div class="welcome-message">
          <span class="icon">👋</span>
          <p>{{ t('welcome.message') }}</p>
        </div>
      </div>

      <!-- Data Storage Demo -->
      <div class="demo-section">
        <h4>{{ t('dataStorage.title') }}</h4>
        <div class="storage-demo">
          <div class="storage-controls">
            <input
              v-model="storageKey"
              type="text"
              :placeholder="t('dataStorage.keyPlaceholder')"
            />
            <input
              v-model="storageValue"
              type="text"
              :placeholder="t('dataStorage.valuePlaceholder')"
            />
            <button @click="saveData">{{ t('dataStorage.setButton') }}</button>
          </div>
          <div class="storage-list">
            <h6>{{ t('dataStorage.storedDataTitle') }}</h6>
            <div v-if="storedData.length === 0" class="empty-state">
              {{ t('dataStorage.noDataMessage') }}
            </div>
            <ul v-else>
              <li
                v-for="item in storedData"
                :key="item.key"
                class="storage-item"
              >
                <span class="storage-key">{{ item.key }}</span>
                <span class="storage-value">{{ item.value }}</span>
                <button class="remove-btn" @click="removeData(item.key)">
                  ×
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Event Communication Demo -->
      <div class="demo-section">
        <h4>{{ t('eventCommunication.title') }}</h4>
        <div class="event-demo">
          <div class="event-controls">
            <input
              v-model="messageText"
              type="text"
              :placeholder="t('eventCommunication.messagePlaceholder')"
            />
            <button @click="sendTestMessage">
              {{ t('eventCommunication.sendButton') }}
            </button>
            <button class="clear-btn" @click="clearEvents">
              {{ t('eventCommunication.clearButton') }}
            </button>
          </div>
          <div class="event-log">
            <h6>{{ t('eventCommunication.allEventsTitle') }}</h6>
            <div v-if="allEvents.length === 0" class="empty-state">
              {{ t('eventCommunication.noEventsMessage') }}
            </div>
            <ul v-else>
              <li v-for="event in allEvents" :key="event.id" class="event-item">
                <span class="event-time">{{
                  formatTime(event.timestamp)
                }}</span>
                <span class="event-type">{{ event.type }}</span>
                <span class="event-data">{{ event.data }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { IPluginServiceProxy } from '@vue-plugin-arch/types'
import { useI18n } from 'vue-i18n'
import { messages, defaultLocale } from '../locales'

// Setup i18n with Composition API
const { t, locale } = useI18n({
  messages,
  locale: defaultLocale,
  fallbackLocale: 'en',
})

// Props
interface Props {
  name?: string
  version?: string
  proxy: IPluginServiceProxy
}

const props = defineProps<Props>()

// Inject the plugin service proxy (provided by the plugin system)
const proxy = props.proxy

// Reactive data
const messageText = ref('')
const storageKey = ref('')
const storageValue = ref('')

const storedData = ref<Array<{ key: string; value: string }>>([])

const allEvents = ref<
  Array<{
    id: number
    type: string
    data: string
    timestamp: number
  }>
>([])

interface message {
  message: string
  timestamp: number
  name: string
}

// Methods
const sendTestMessage = () => {
  if (messageText.value.trim() && proxy) {
    // Emit event through the plugin system
    proxy.eventApi.emit('hello-world:message', {
      message: messageText.value,
      timestamp: Date.now(),
      name: props.name,
    })
    messageText.value = ''
  }
}

const saveData = async () => {
  if (storageKey.value.trim() && storageValue.value.trim() && proxy) {
    await proxy.dataApi.set(storageKey.value, storageValue.value)

    await loadAllStoredData()

    // Clear inputs after successful save
    storageKey.value = ''
    storageValue.value = ''
  }
}

const removeData = async (key: string) => {
  if (proxy) {
    await proxy.dataApi.remove(key)
    await loadAllStoredData()
  }
}

const loadAllStoredData = async () => {
  if (proxy) {
    const allData = await proxy.dataApi.getAll()
    const data = Object.entries(allData).map(([key, value]) => ({
      key,
      value: String(value),
    }))
    storedData.value = data
  }
}

const addEvent = (type: string, data: string) => {
  const event = {
    id: Date.now(),
    type,
    data,
    timestamp: Date.now(),
  }

  allEvents.value.unshift(event)
}

const clearEvents = () => {
  allEvents.value = []
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

// Lifecycle
onMounted(async () => {
  // Load saved locale from storage if available
  if (proxy) {
    try {
      const savedLocale = await proxy.dataApi.get('global:language')
      if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh')) {
        locale.value = savedLocale as 'en' | 'zh'
      }
    } catch (error) {
      console.warn('Failed to load saved locale:', error)
    }
  }

  // Load all stored data
  await loadAllStoredData()

  // Listen for events from other plugins or the system
  if (proxy) {
    proxy.eventApi.on('plugin:loaded', payload => {
      addEvent('plugin:loaded', payload.name)
    })
    proxy.eventApi.on('plugin:unloaded', payload => {
      addEvent('plugin:unloaded', payload.name)
    })
    proxy.eventApi.on('data:changed', payload => {
      addEvent(
        'data:changed',
        `[${payload.name}] ${payload.key}: ${payload.oldValue} -> ${payload.newValue}`
      )
    })

    proxy.eventApi.on(
      'data:changed',
      payload => {
        addEvent(
          'data:changed',
          `[${payload.name}] ${payload.key}: ${payload.oldValue} -> ${payload.newValue}`
        )
      },
      'global'
    )

    proxy.eventApi.on('hello-world:message', payload => {
      addEvent(
        'hello-world:message',
        `[${(payload as message).name}](${(payload as message).timestamp}): ${(payload as message).message}`
      )
    })
  }
})
</script>

<style scoped>
.hello-world-panel {
  background-color: var(--dv-group-view-background-color);
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--dv-activegroup-visiblepanel-tab-color);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--dv-separator-border);
  background-color: var(--dv-tabs-and-actions-container-background-color);
  padding: 8px 16px;
  margin: -16px -16px 20px -16px;
  height: var(--dv-tabs-and-actions-container-height);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-header h3 {
  margin: 0;
  color: var(--dv-activegroup-visiblepanel-tab-color);
  font-size: var(--dv-tabs-and-actions-container-font-size);
}

.version {
  background-color: var(--dv-activegroup-visiblepanel-tab-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  border: 1px solid var(--dv-paneview-active-outline-color);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.welcome-section {
  background-color: var(--dv-inactivegroup-visiblepanel-tab-background-color);
  border: 1px solid var(--dv-separator-border);
  padding: 16px;
  border-radius: 8px;
}

.welcome-message {
  display: flex;
  align-items: center;
  gap: 12px;
}

.welcome-message .icon {
  font-size: 24px;
}

.welcome-message p {
  margin: 0;
  font-size: 16px;
  color: var(--dv-activegroup-visiblepanel-tab-color);
}

.demo-section {
  background-color: var(--dv-tabs-and-actions-container-background-color);
  border: 1px solid var(--dv-separator-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.demo-section h4 {
  margin: 0 0 16px 0;
  color: var(--dv-activegroup-visiblepanel-tab-color);
  font-size: 16px;
  border-bottom: 1px solid var(--dv-paneview-header-border-color);
  padding-bottom: 8px;
}

.storage-demo,
.event-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.storage-controls,
.event-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.storage-controls input,
.event-controls input {
  flex: 1;
  min-width: 120px;
  padding: 6px 8px;
  border: 1px solid var(--dv-separator-border);
  border-radius: 4px;
  font-size: 13px;
  background-color: var(--dv-group-view-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
}

.storage-controls input:focus,
.event-controls input:focus {
  outline: 1px solid var(--dv-paneview-active-outline-color);
}

.storage-controls button {
  padding: 6px 12px;
  background-color: var(--dv-activegroup-visiblepanel-tab-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  border: 1px solid var(--dv-paneview-active-outline-color);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.storage-controls button:hover {
  background-color: var(--dv-icon-hover-background-color);
}

.event-controls button {
  padding: 6px 12px;
  background-color: var(--dv-activegroup-visiblepanel-tab-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  border: 1px solid var(--dv-separator-border);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.event-controls button:hover {
  background-color: var(--dv-icon-hover-background-color);
}

.event-controls .clear-btn {
  background-color: var(--dv-drag-over-background-color);
  border-color: var(--dv-drag-over-border-color);
}

.event-controls .clear-btn:hover {
  background-color: var(--dv-icon-hover-background-color);
}

.storage-list {
  background-color: var(--dv-inactivegroup-visiblepanel-tab-background-color);
  border: 1px solid var(--dv-separator-border);
  padding: 12px;
  border-radius: 4px;
}

.storage-list h6 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}

.storage-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.storage-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--dv-separator-border);
}

.storage-item:last-child {
  border-bottom: none;
}

.storage-key {
  color: var(--dv-activegroup-visiblepanel-tab-color);
  font-weight: 500;
  min-width: 100px;
}

.storage-value {
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
  flex: 1;
  word-break: break-word;
}

.remove-btn {
  background-color: var(--dv-drag-over-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  border: 1px solid var(--dv-drag-over-border-color);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.remove-btn:hover {
  background-color: var(--dv-icon-hover-background-color);
}

.empty-state {
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
  font-style: italic;
  font-size: 13px;
  text-align: center;
  padding: 12px;
}

.event-log {
  background-color: var(--dv-inactivegroup-visiblepanel-tab-background-color);
  border: 1px solid var(--dv-separator-border);
  padding: 12px;
  border-radius: 4px;
}

.event-log h6 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}

.event-log ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.event-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--dv-separator-border);
}

.event-item:last-child {
  border-bottom: none;
}

.event-time {
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
  min-width: 60px;
}

.event-type {
  color: var(--dv-activegroup-visiblepanel-tab-color);
  font-weight: 500;
  min-width: 80px;
}

.event-data {
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
  flex: 1;
}
</style>
