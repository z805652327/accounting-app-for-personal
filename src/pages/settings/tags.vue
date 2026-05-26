<template>
  <div class="page-tags">
    <div class="tag-list">
      <div v-for="tag in tags" :key="tag.id" class="tag-item">
        <div class="tag-color" :style="{background: tag.color || '#007AFF'}"></div>
        <span class="tag-name">{{ tag.name }}</span>
        <span name="close" color="#C44536" size="14px" @click="delTag(tag.id)"></span>
      </div>
      <div v-if="tags.length === 0" class="empty">暂无标签</div>
    </div>

    <div class="add-section">
      <el-input v-model="newName" placeholder="输入标签名称" style="margin-bottom:8px" />
      <div class="color-picker">
        <div
          v-for="(color, idx) in colorOptions"
          :key="color"
          :class="['color-swatch', { active: colorIndex === idx }]"
          :style="{ background: color }"
          @click="colorIndex = idx"
        ></div>
      </div>
      <el-button type="primary" @click="addTag" style="margin-top:8px;width:100%">添加标签</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'

interface Tag { id: number; name: string; color: string }

const tags = ref<Tag[]>([])
const newName = ref('')
const colorIndex = ref(0)
const colorOptions = ['#C44536', '#2D7D7A', '#E08900', '#1C1915', '#6B6560', '#4A90D9', '#7C5CBF', '#50B86C', '#E060A0', '#9E9790']

async function loadTags() {
  const db = await getDatabase()
  tags.value = await db.query<Tag>('SELECT * FROM tags ORDER BY name')
}

onShow(loadTags)

async function addTag() {
  const name = newName.value.trim()
  if (!name) { uni.showToast({ title: '请输入标签名称' }); return }
  try {
    const db = await getDatabase()
    await db.insert('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)', [name, colorOptions[colorIndex.value]])
    newName.value = ''
    loadTags()
  } catch (e: any) {
    uni.showToast({ title: '添加失败: ' + (e.message || '未知错误') })
  }
}

async function delTag(id: number) {
  const db = await getDatabase()
  await db.execute('DELETE FROM tags WHERE id = ?', [id])
  await db.execute('DELETE FROM transaction_tags WHERE tag_id = ?', [id])
  await loadTags()
}
</script>

<style lang="scss" scoped>
.page-tags { padding: 10px; }
.tag-list { background: #FDFCF9; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
.tag-item { display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid #EDE8E0; }
.tag-color { width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
.tag-name { flex: 1; font-size: 14px; }
.empty { text-align: center; color: #9E9790; padding: 20px; font-size: 13px; }
.add-section { background: #FDFCF9; border-radius: 8px; padding: 14px; }
.color-picker { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.color-swatch { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; }
.color-swatch:hover { transform: scale(1.1); }
.color-swatch.active { border-color: #1C1915; transform: scale(1.2); box-shadow: 0 1px 4px rgba(0,0,0,0.25); }
</style>
