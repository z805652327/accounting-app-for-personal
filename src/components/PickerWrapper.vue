<template>
  <input
    v-if="mode === 'date' && fields === 'month'"
    type="month"
    :value="value"
    @change="onDateChange"
    class="stub-picker"
  />
  <input
    v-else-if="mode === 'date'"
    type="date"
    :value="value"
    @change="onDateChange"
    class="stub-picker"
  />
  <select
    v-else
    :value="value"
    @change="onSelectChange"
    :disabled="disabled"
    class="stub-picker"
  >
    <option
      v-for="(item, idx) in range"
      :key="idx"
      :value="idx"
      :disabled="typeof item === 'object' && item.disabled"
    >{{ typeof item === 'string' ? item : item.label ?? item }}</option>
  </select>
</template>

<script setup lang="ts">
defineProps<{
  value?: number | string
  range?: (string | Record<string, any>)[]
  disabled?: boolean
  mode?: string
  fields?: string
}>()

const emit = defineEmits<{
  change: [e: { detail: { value: number | string } }]
}>()

function onDateChange(e: Event) {
  const target = e.target as HTMLInputElement
  emit('change', { detail: { value: target.value } })
}

function onSelectChange(e: Event) {
  const target = e.target as HTMLSelectElement
  const raw = target.value
  const num = Number(raw)
  emit('change', { detail: { value: isNaN(num) ? raw : num } })
}
</script>
