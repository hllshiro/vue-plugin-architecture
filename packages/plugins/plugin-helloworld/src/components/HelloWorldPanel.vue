<template>
  <div class="hello-world-panel">
    <div class="panel-header">
      <h3>Hello World Plugin</h3>
      <span class="version">v{{ version }}</span>
    </div>

    <div class="panel-content">
      <!-- Welcome Message -->
      <div class="welcome-section">
        <div class="welcome-message">
          <span class="icon">👋</span>
          <p>{{ welcomeMessage }}</p>
        </div>
      </div>

      <!-- Data Storage Demo -->
      <div class="demo-section">
        <h4>Data Storage Demo</h4>
        <div class="storage-demo">
          <div class="storage-controls">
            <input v-model="storageKey" type="text" placeholder="Storage key" />
            <input
              v-model="storageValue"
              type="text"
              placeholder="Storage value"
            />
            <button @click="saveData">Set</button>
          </div>
          <div class="storage-list">
            <h6>Stored Data</h6>
            <div v-if="storedData.length === 0" class="empty-state">
              No data stored yet
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
        <h4>Event Communication Demo</h4>
        <div class="event-demo">
          <div class="event-controls">
            <input
              v-model="messageText"
              type="text"
              placeholder="Enter message to send"
            />
            <button @click="sendTestMessage">Send Event</button>
            <button class="clear-btn" @click="clearEvents">Clear Events</button>
          </div>
          <div class="event-log">
            <h6>All Events</h6>
            <div v-if="allEvents.length === 0" class="empty-state">
              No events yet
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
const welcomeMessage = ref('Hello from Vue Plugin Architecture!')
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

// Get data API for storage operations
const dataAPI = proxy?.getDataAPI()

// Methods
const sendTestMessage = () => {
  if (messageText.value.trim() && proxy) {
    // Emit event through the plugin system
    proxy.eventBus.emit('hello-world:message', {
      message: messageText.value,
      timestamp: Date.now(),
      name: props.name,
    })

    addEvent('message-sent', `Sent: ${messageText.value}`)
    messageText.value = ''
  }
}

const saveData = async () => {
  if (storageKey.value.trim() && storageValue.value.trim() && dataAPI) {
    try {
      await dataAPI.set(storageKey.value, storageValue.value)

      // Update the stored data list
      const existingIndex = storedData.value.findIndex(
        item => item.key === storageKey.value
      )
      if (existingIndex >= 0) {
        storedData.value[existingIndex].value = storageValue.value
      } else {
        storedData.value.push({
          key: storageKey.value,
          value: storageValue.value,
        })
      }

      addEvent('data-save', `Saved key: ${storageKey.value}`)

      // Clear inputs after successful save
      storageKey.value = ''
      storageValue.value = ''
    } catch (error) {
      addEvent('data-error', `Save failed: ${error}`)
    }
  }
}

const removeData = async (key: string) => {
  if (dataAPI) {
    try {
      await dataAPI.remove(key)
      storedData.value = storedData.value.filter(item => item.key !== key)
      addEvent('data-remove', `Removed key: ${key}`)
    } catch (error) {
      addEvent('data-error', `Remove failed: ${error}`)
    }
  }
}

const loadAllStoredData = async () => {
  if (dataAPI) {
    try {
      const allData = await dataAPI.getAll()
      const data = Object.entries(allData).map(([key, value]) => ({
        key,
        value: String(value),
      }))
      storedData.value = data
    } catch (error) {
      console.warn('Failed to load stored data:', error)
    }
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
  // Load welcome message from storage if available
  if (dataAPI) {
    try {
      const savedMessage = await dataAPI.get('welcomeMessage')
      if (savedMessage) {
        welcomeMessage.value = String(savedMessage)
      }
    } catch (error) {
      console.warn('Failed to load welcome message:', error)
    }
  }

  // Load all stored data
  await loadAllStoredData()

  // Add initial events
  setTimeout(() => {
    addEvent('plugin-loaded', 'Plugin loaded successfully')
  }, 100)

  // Listen for events from other plugins or the system
  if (proxy) {
    proxy.eventBus.on('system:ready', () => {
      addEvent('system-ready', 'System is ready')
    })
  }
})
</script>

<style scoped>
.hello-world-panel {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e1e5e9;
}

.panel-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
}

.version {
  background: #3498db;
  color: white;
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
  background: #f8f9fa;
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
  color: #2c3e50;
}

.demo-section {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.demo-section h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 16px;
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
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  font-size: 13px;
}

.storage-controls button {
  padding: 6px 12px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.storage-controls button:hover {
  background: #219a52;
}

.event-controls button {
  padding: 6px 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.event-controls button:hover {
  background: #2980b9;
}

.event-controls .clear-btn {
  background: #e74c3c;
}

.event-controls .clear-btn:hover {
  background: #c0392b;
}

.storage-list {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
}

.storage-list h6 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #5a6c7d;
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
  border-bottom: 1px solid #e9ecef;
}

.storage-item:last-child {
  border-bottom: none;
}

.storage-key {
  color: #495057;
  font-weight: 500;
  min-width: 100px;
}

.storage-value {
  color: #6c757d;
  flex: 1;
  word-break: break-word;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
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
  background: #c82333;
}

.empty-state {
  color: #6c757d;
  font-style: italic;
  font-size: 13px;
  text-align: center;
  padding: 12px;
}

.event-log {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
}

.event-log h6 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #5a6c7d;
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
  border-bottom: 1px solid #e9ecef;
}

.event-item:last-child {
  border-bottom: none;
}

.event-time {
  color: #6c757d;
  min-width: 60px;
}

.event-type {
  color: #495057;
  font-weight: 500;
  min-width: 80px;
}

.event-data {
  color: #6c757d;
  flex: 1;
}
</style>
