<template>
  <div class="page">
    <h2 class="page-title">密码生成器</h2>
    <p class="hint">独立生成强密码，可自定义长度与字符集，生成后一键复制（不自动入库）。</p>

    <!-- 生成结果 + 强度 -->
    <div class="card">
      <div class="result-box">
        <span class="result-text">{{ pwd }}</span>
        <van-icon name="replay" class="regen-icon" @click="regenerate" />
        <van-icon name="copy" class="copy-icon" @click="onCopy" />
      </div>

      <!-- 强度条 -->
      <div class="strength">
        <div class="strength-bar">
          <div class="strength-fill" :style="{ width: strength.percent + '%', background: strength.color }" />
        </div>
        <div class="strength-meta">
          <span class="strength-label" :style="{ color: strength.color }">{{ strength.label }}</span>
          <span class="strength-suggestions">{{ strength.suggestions.join('；') }}</span>
        </div>
      </div>

      <div class="btn-row">
        <van-button type="primary" block icon="copy" @click="onCopy">复制密码</van-button>
      </div>
    </div>

    <!-- 选项 -->
    <div class="card">
      <div class="section-label">长度：{{ opts.length }}</div>
      <van-slider v-model="opts.length" :min="6" :max="40" :step="1" :active-color="accent" />

      <van-cell title="大写字母 (A-Z)" :border="false">
        <template #right-icon><van-switch v-model="opts.upper" size="18" /></template>
      </van-cell>
      <van-cell title="小写字母 (a-z)" :border="false">
        <template #right-icon><van-switch v-model="opts.lower" size="18" /></template>
      </van-cell>
      <van-cell title="数字 (0-9)" :border="false">
        <template #right-icon><van-switch v-model="opts.digit" size="18" /></template>
      </van-cell>
      <van-cell title="符号 (!@#$…)" :border="false">
        <template #right-icon><van-switch v-model="opts.symbol" size="18" /></template>
      </van-cell>
      <van-cell title="排除易混淆字符 (1lI0Oo)" :border="false">
        <template #right-icon><van-switch v-model="opts.excludeSimilar" size="18" /></template>
      </van-cell>

      <div class="btn-row">
        <van-button size="small" plain icon="replay" @click="regenerate">重新生成</van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { showToast } from 'vant'
import { generatePasswordAdvanced, passwordStrength, type GenOptions } from '@/utils/crypto'
import { copySecret } from '@/utils/clipboard'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const accent = ui.accent

const opts = reactive<Required<GenOptions>>({
  length: 16,
  upper: true,
  lower: true,
  digit: true,
  symbol: true,
  excludeSimilar: false,
})

const pwd = ref('')
const strength = computed(() => passwordStrength(pwd.value))

function regenerate() {
  pwd.value = generatePasswordAdvanced({
    length: opts.length,
    upper: opts.upper,
    lower: opts.lower,
    digit: opts.digit,
    symbol: opts.symbol,
    excludeSimilar: opts.excludeSimilar,
  })
}

async function onCopy() {
  if (!pwd.value) return
  const ok = await copySecret(pwd.value)
  showToast(ok ? '已复制，30 秒后自动清除' : '复制失败，请长按手动复制')
}

// 任何选项变化都重新生成（实时预览）
watch(opts, () => regenerate(), { deep: true })
regenerate()
</script>

<style scoped>
.hint {
  margin: 0 0 8px;
  padding: 0 16px;
  font-size: 12px;
  line-height: 1.7;
  color: #969799;
}
.section-label {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.result-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f7f8fa;
  border-radius: 10px;
  word-break: break-all;
}
html.dark .result-box {
  background: #242424;
}
.result-text {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #323233;
  word-break: break-all;
}
html.dark .result-text {
  color: #e6e6e6;
}
.regen-icon,
.copy-icon {
  font-size: 20px;
  color: #1989fa;
  cursor: pointer;
  flex-shrink: 0;
}
.strength {
  margin-top: 12px;
}
.strength-bar {
  height: 8px;
  border-radius: 999px;
  background: #ebedf0;
  overflow: hidden;
}
html.dark .strength-bar {
  background: #333;
}
.strength-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease, background 0.2s ease;
}
.strength-meta {
  margin-top: 6px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.strength-label {
  font-size: 14px;
  font-weight: 700;
}
.strength-suggestions {
  font-size: 12px;
  color: #969799;
}
.btn-row {
  margin-top: 14px;
}
</style>
