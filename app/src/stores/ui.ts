import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getItem, setItem } from './storage'

export type ThemeMode = 'light' | 'dark'

export interface AccentPreset {
  name: string
  value: string
}

/** 可选强调色（应用主色，用于按钮 / 标签栏 / 选中态等） */
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: '经典蓝', value: '#1989fa' },
  { name: '微信绿', value: '#07c160' },
  { name: '活力橙', value: '#ff976a' },
  { name: '魅影红', value: '#ee0a24' },
  { name: '优雅紫', value: '#7232cb' },
  { name: '湖心青', value: '#00b8d4' },
]

const THEME_KEY = 'uiTheme'
const ACCENT_KEY = 'uiAccent'

export const useUiStore = defineStore('ui', () => {
  const theme = ref<ThemeMode>(getItem<ThemeMode>(THEME_KEY, 'light'))
  const accent = ref<string>(getItem<string>(ACCENT_KEY, '#1989fa'))

  const isDark = computed(() => theme.value === 'dark')

  function setTheme(t: ThemeMode): void {
    theme.value = t
    setItem(THEME_KEY, t)
  }

  function toggleTheme(): void {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  function setAccent(c: string): void {
    accent.value = c
    setItem(ACCENT_KEY, c)
  }

  return { theme, accent, isDark, setTheme, toggleTheme, setAccent }
})
