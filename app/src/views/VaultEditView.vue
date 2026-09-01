<template>
  <div class="page">
    <h2 class="page-title">{{ isEdit ? '编辑密码' : '新增密码' }}</h2>

    <!-- 名称（自定义，点击复制） -->
    <div class="card">
      <div class="section-label">名称</div>
      <van-field v-model="form.name" label="名称" placeholder="如：阿里邮箱 / WiFi 密码 / 银行卡" />
      <div class="btn-row">
        <van-button size="small" plain type="primary" @click="onCopy(form.name)">
          复制名称
        </van-button>
      </div>
    </div>

    <!-- 密码（自定义 + 随机生成 + 复制） -->
    <div class="card">
      <div class="section-label">密码</div>
      <van-field
        v-model="form.password"
        :type="showPwd ? 'text' : 'password'"
        label="密码"
        placeholder="输入或点击「随机生成」"
        @click-right-icon="showPwd = !showPwd"
      >
        <template #right-icon>
          <van-icon :name="showPwd ? 'eye-o' : 'closed-eye'" />
        </template>
      </van-field>
      <div class="btn-row">
        <van-button size="small" plain type="primary" @click="onGenPwd">随机生成</van-button>
        <van-button size="small" plain @click="onCopy(form.password)">复制密码</van-button>
      </div>
      <!-- 密码强度（实时评估） -->
      <div v-if="form.password" class="pwd-strength">
        <div class="pwd-strength-bar">
          <div
            class="pwd-strength-fill"
            :style="{ width: pwdStrength.percent + '%', background: pwdStrength.color }"
          />
        </div>
        <div class="pwd-strength-meta">
          <span class="pwd-strength-label" :style="{ color: pwdStrength.color }">
            强度：{{ pwdStrength.label }}
          </span>
          <span class="pwd-strength-tip">{{ pwdStrength.suggestions.join('；') }}</span>
        </div>
      </div>
    </div>

    <!-- 动态验证码：通用 TOTP / Steam 令牌 -->
    <div class="card">
      <div class="section-label">动态验证码（TOTP，可选）</div>
      <van-radio-group v-model="form.totpType" direction="horizontal" class="totp-type">
        <van-radio name="standard">通用验证器</van-radio>
        <van-radio name="steam">Steam 令牌</van-radio>
      </van-radio-group>
      <van-field
        v-model="form.totp"
        :label="form.totpType === 'steam' ? 'base64 密钥' : 'base32 密钥'"
        :placeholder="
          form.totpType === 'steam'
            ? '粘贴 Steam 导出的 base64 密钥'
            : '粘贴 base32 密钥，如 JBSWY3DPEHPK3PXP'
        "
        :error-message="totpError"
      />
      <div v-if="totpPreview" class="totp-preview">
        <van-tag v-if="form.totpType === 'steam'" type="primary" plain class="totp-tag">Steam</van-tag>
        <span class="totp-code">{{ totpPreview.code }}</span>
        <van-circle
          :current-rate="(totpPreview.remaining / 30) * 100"
          :rate="100"
          :speed="100"
          :text="String(totpPreview.remaining)"
          size="36"
        />
      </div>
      <p class="hint">
        <template v-if="form.totpType === 'steam'">
          保存 Steam 的 shared_secret（base64）后，列表页实时显示 5 位 Steam Guard 令牌与倒计时，对标 Steam
          手机令牌。
        </template>
        <template v-else>
          保存后，列表页会实时显示 6 位动态码与倒计时（兼容 Google Authenticator / 1Password 等标准 TOTP）。
        </template>
      </p>
    </div>

    <!-- 分组 / 标签 -->
    <div class="card">
      <div class="section-label">分组 / 标签</div>
      <van-field v-model="form.group" label="分组" placeholder="如：工作 / 生活 / 银行" />
      <div class="cat-row">
        <button
          v-for="c in categoryPresets"
          :key="c.name"
          type="button"
          class="cat-chip"
          :class="{ active: form.group === c.name }"
          @click="onPickCategory(c.name)"
        >
          <van-icon :name="c.icon" />
          <span>{{ c.name }}</span>
        </button>
      </div>
      <van-field
        v-model="tagInput"
        label="标签"
        placeholder="输入后回车添加"
        @keyup.enter="onAddTag"
      >
        <template #button>
          <van-button size="small" type="primary" @click="onAddTag">添加</van-button>
        </template>
      </van-field>
      <div class="tags-row" v-if="form.tags.length">
        <van-tag
          v-for="(t, i) in form.tags"
          :key="t"
          closeable
          size="medium"
          type="primary"
          plain
          @close="form.tags.splice(i, 1)"
        >
          {{ t }}
        </van-tag>
      </div>
      <p class="hint">分组用于列表页聚合展示，标签用于附加分类。都可自定义。</p>
    </div>

    <!-- 自定义字段 -->
    <div class="card">
      <div class="section-label">自定义字段</div>
      <div v-for="(f, i) in form.fields" :key="i" class="field-block">
        <div class="field-line">
          <van-field v-model="f.label" label="名称" placeholder="如：手机号 / 密保问题" />
          <van-field
            v-model="f.value"
            :type="f.secret && !fieldReveal[i] ? 'password' : 'text'"
            label="值"
            placeholder="字段内容"
          >
            <template #right-icon>
              <van-icon
                v-if="f.secret"
                :name="fieldReveal[i] ? 'eye-o' : 'closed-eye'"
                @click="fieldReveal[i] = !fieldReveal[i]"
              />
            </template>
          </van-field>
        </div>
        <div class="field-tools">
          <van-switch v-model="f.secret" size="16" />
          <span class="field-secret-label">隐藏值</span>
          <van-button size="mini" plain type="danger" @click="form.fields.splice(i, 1)">删除</van-button>
        </div>
      </div>
      <van-button size="small" plain type="primary" icon="plus" @click="onAddField">添加字段</van-button>
      <p class="hint">账号本子风格：可附加任意键值（手机号、密保、链接等），敏感字段可设为「隐藏值」。</p>
    </div>

    <!-- 失效时间 -->
    <div class="card">
      <div class="section-label">失效时间</div>
      <van-cell title="永不过期" :border="false">
        <template #right-icon>
          <van-switch v-model="neverExpire" size="20" />
        </template>
      </van-cell>
      <template v-if="!neverExpire">
        <van-field
          v-model="expireDate"
          label="失效日期"
          placeholder="选择日期"
          readonly
          is-link
          @click="showExpirePicker = true"
        />
        <van-field
          v-model="expireTime"
          label="失效时间"
          placeholder="选择时间"
          readonly
          is-link
          @click="showTimePicker = true"
        />
      </template>
      <p class="hint">到达设定时间后，列表页会标记「已失效」并隐藏密码明文。到期后仍可重新编辑。</p>
    </div>

    <!-- 备注 -->
    <div class="card">
      <div class="section-label">备注</div>
      <van-field
        v-model="form.note"
        rows="2"
        autosize
        type="textarea"
        maxlength="200"
        show-word-limit
        placeholder="最多 200 字（可选）"
      />
    </div>

    <div class="btn-row save-row">
      <van-button type="primary" block :loading="saving" @click="onSave">保存</van-button>
    </div>

    <!-- 日期/时间选择器 -->
    <van-popup v-model:show="showExpirePicker" position="bottom" round>
      <van-date-picker
        v-model="pickerDate"
        :min-date="minDate"
        @confirm="onPickDate"
        @cancel="showExpirePicker = false"
      />
    </van-popup>
    <van-popup v-model:show="showTimePicker" position="bottom" round>
      <van-time-picker
        v-model="pickerTime"
        @confirm="onPickTime"
        @cancel="showTimePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useVaultStore, type VaultEntry, type CustomField } from '@/stores/vault'
import { generatePassword, passwordStrength } from '@/utils/crypto'
import { copySecret } from '@/utils/clipboard'
import { CATEGORY_PRESETS } from '@/utils/categories'
import {
  currentTotpByType,
  isValidBase32,
  isValidSteamSecret,
  type TotpType,
} from '@/utils/totp'

const vault = useVaultStore()
const route = useRoute()
const router = useRouter()

const categoryPresets = CATEGORY_PRESETS
/** 密码强度（实时） */
const pwdStrength = computed(() => passwordStrength(form.value.password))

const isEdit = computed(() => !!route.query.id)

const form = ref({
  name: '',
  password: '',
  group: '',
  tags: [] as string[],
  note: '',
  fields: [] as CustomField[],
  totp: '',
  totpType: 'standard' as TotpType,
})
/** 自定义字段的「显示/隐藏」开关（不入库，仅界面用） */
const fieldReveal = ref<Record<number, boolean>>({})
const tagInput = ref('')
const showPwd = ref(false)
const neverExpire = ref(true)
const expireDate = ref('')
const expireTime = ref('')
const showExpirePicker = ref(false)
const showTimePicker = ref(false)
const pickerDate = ref<string[]>(['2026', '01', '01'])
const pickerTime = ref<string[]>(['12', '00'])
const minDate = new Date()
const saving = ref(false)

/* 编辑模式：回填 */
if (isEdit.value) {
  const id = String(route.query.id)
  const e: VaultEntry | undefined = vault.data.entries.find((x) => x.id === id)
  if (e) {
    form.value.name = e.name
    form.value.password = e.password
    form.value.group = e.group
    form.value.tags = [...e.tags]
    form.value.note = e.note
    form.value.fields = (e.fields || []).map((f) => ({ ...f }))
    form.value.totp = e.totp || ''
    form.value.totpType = e.totpType === 'steam' ? 'steam' : 'standard'
    if (e.expiresAt) {
      neverExpire.value = false
      const d = new Date(e.expiresAt)
      expireDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      expireTime.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } else {
      neverExpire.value = true
    }
  } else {
    showToast('条目不存在')
    router.replace('/vault')
  }
}

function onAddTag() {
  const t = tagInput.value.trim()
  if (!t) return
  if (!form.value.tags.includes(t)) form.value.tags.push(t)
  tagInput.value = ''
}

function onPickCategory(name: string) {
  // 再次点击同一个则取消，方便清空
  form.value.group = form.value.group === name ? '' : name
}

async function onCopy(text: string) {
  if (!text) {
    showToast('内容为空')
    return
  }
  const ok = await copySecret(text)
  showToast(ok ? '已复制，30 秒后自动清除' : '复制失败，请长按手动复制')
}

function onGenPwd() {
  form.value.password = generatePassword(16)
  showToast('已生成 16 位随机密码')
}

function onAddField() {
  form.value.fields.push({ label: '', value: '', secret: false })
}

/* ---------- TOTP 实时预览 ---------- */
const totpPreview = ref<{ code: string; remaining: number } | null>(null)
let totpTimer: ReturnType<typeof setInterval> | null = null
const totpValid = computed(() =>
  form.value.totpType === 'steam'
    ? isValidSteamSecret(form.value.totp)
    : isValidBase32(form.value.totp),
)
const totpError = computed(() => {
  if (!form.value.totp.trim()) return ''
  if (totpValid.value) return ''
  return form.value.totpType === 'steam'
    ? '密钥格式不正确（应为 Steam 导出的 base64 字符串）'
    : '密钥格式不正确（应为 base32，仅含 A-Z 与 2-7）'
})
async function refreshTotpPreview() {
  if (!totpValid.value) {
    totpPreview.value = null
    return
  }
  totpPreview.value = await currentTotpByType(form.value.totp, form.value.totpType)
  if (!totpTimer) totpTimer = setInterval(() => void refreshTotpPreview(), 1000)
}
watch(() => form.value.totp, () => void refreshTotpPreview())
onMounted(() => void refreshTotpPreview())
onBeforeUnmount(() => {
  if (totpTimer) {
    clearInterval(totpTimer)
    totpTimer = null
  }
})

function onPickDate({ selectedValues }: { selectedValues: string[] }) {
  expireDate.value = selectedValues.join('-')
  showExpirePicker.value = false
}

function onPickTime({ selectedValues }: { selectedValues: string[] }) {
  expireTime.value = selectedValues.join(':')
  showTimePicker.value = false
}

async function onSave() {
  if (!form.value.name.trim()) {
    showToast('请填写名称')
    return
  }
  const expiresAt = neverExpire.value
    ? 0
    : new Date(`${expireDate.value}T${expireTime.value || '23:59'}`).getTime() || 0

  const fields = form.value.fields
    .filter((f) => f.label.trim())
    .map((f) => ({
      label: f.label.trim(),
      value: f.value,
      secret: f.secret === true,
    }))
  const totp = form.value.totp.trim().toUpperCase()

  saving.value = true
  try {
    if (isEdit.value) {
      const id = String(route.query.id)
      vault.updateEntry(id, {
        name: form.value.name.trim(),
        password: form.value.password,
        group: form.value.group.trim(),
        tags: form.value.tags,
        note: form.value.note.trim(),
        expiresAt,
        fields,
        totp,
        totpType: form.value.totpType,
      })
      showToast('已保存')
    } else {
      vault.addEntry({
        name: form.value.name.trim(),
        password: form.value.password,
        group: form.value.group.trim(),
        tags: form.value.tags,
        note: form.value.note.trim(),
        expiresAt,
        favorite: false,
        fields,
        totp,
        totpType: form.value.totpType,
      })
      if (form.value.group.trim()) vault.addGroup(form.value.group.trim())
      showToast('已新增')
    }
    router.replace('/vault')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.section-label {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #969799;
}
.btn-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.save-row {
  padding: 0 16px 32px;
}
/* 密码强度 */
.pwd-strength {
  margin-top: 12px;
}
.pwd-strength-bar {
  height: 6px;
  border-radius: 999px;
  background: #ebedf0;
  overflow: hidden;
}
html.dark .pwd-strength-bar {
  background: #333;
}
.pwd-strength-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease, background 0.2s ease;
}
.pwd-strength-meta {
  margin-top: 6px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.pwd-strength-label {
  font-size: 13px;
  font-weight: 700;
}
.pwd-strength-tip {
  font-size: 12px;
  color: #969799;
}
/* 分类快捷选择 */
.cat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #ebedf0;
  background: #f7f8fa;
  font-size: 12px;
  color: #646566;
  cursor: pointer;
  transition: all 0.12s ease;
}
html.dark .cat-chip {
  background: #242424;
  border-color: #2c2c2c;
  color: #c8c9cc;
}
.cat-chip.active {
  border-color: var(--app-chip-text);
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
  font-weight: 600;
}
/* TOTP 实时预览 */
.totp-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 8px;
}
.totp-code {
  font-family: 'Courier New', monospace;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #07c160;
}
.totp-type {
  margin-bottom: 10px;
}
.totp-tag {
  margin-right: 6px;
}
/* 自定义字段 */
.field-block {
  border: 1px solid #ebedf0;
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 12px;
}
.field-line {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
.field-secret-label {
  font-size: 12px;
  color: #969799;
}
</style>