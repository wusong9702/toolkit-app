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
    </div>

    <!-- 分组 / 标签 -->
    <div class="card">
      <div class="section-label">分组 / 标签</div>
      <van-field v-model="form.group" label="分组" placeholder="如：工作 / 生活 / 银行" />
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
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useVaultStore, type VaultEntry } from '@/stores/vault'
import { generatePassword } from '@/utils/crypto'
import { copyToClipboard } from '@/utils/clipboard'

const vault = useVaultStore()
const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.query.id)

const form = ref({
  name: '',
  password: '',
  group: '',
  tags: [] as string[],
  note: '',
})
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

async function onCopy(text: string) {
  if (!text) {
    showToast('内容为空')
    return
  }
  const ok = await copyToClipboard(text)
  showToast(ok ? '已复制' : '复制失败，请长按手动复制')
}

function onGenPwd() {
  form.value.password = generatePassword(16)
  showToast('已生成 16 位随机密码')
}

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
</style>