<template>
  <div class="page">
    <!-- 顶部汇总 -->
    <div class="summary">
      <div class="summary-main">
        <div class="summary-label">结余</div>
        <div class="summary-value">¥{{ store.balance.toFixed(2) }}</div>
      </div>
      <div class="summary-side">
        <div>
          <span class="side-label">收入</span>
          <span class="side-value income">¥{{ store.totalIncome.toFixed(2) }}</span>
        </div>
        <div>
          <span class="side-label">支出</span>
          <span class="side-value expense">¥{{ store.totalExpense.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- 分类占比：纯 CSS 画的，不引图表库，省体积 -->
    <div v-if="store.byCategory.length" class="card">
      <div class="section-label">支出构成</div>
      <div class="ratio-bar">
        <span
          v-for="c in store.byCategory"
          :key="c.id"
          class="ratio-seg"
          :style="{ width: c.percent + '%', background: c.color }"
        />
      </div>
      <div class="legend">
        <div v-for="c in store.byCategory" :key="c.id" class="legend-item">
          <span class="dot" :style="{ background: c.color }" />
          <span class="legend-name">{{ c.icon }} {{ c.name }}</span>
          <span class="legend-amount">¥{{ c.amount.toFixed(2) }}</span>
          <span class="legend-percent">{{ c.percent }}%</span>
        </div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div v-if="store.groupedByDate.length" class="records">
      <div v-for="g in store.groupedByDate" :key="g.date" class="day-group">
        <div class="day-header">
          <span>{{ g.label }}</span>
          <span class="day-sum">
            支 ¥{{ g.expense.toFixed(2) }}
            <template v-if="g.income > 0"> · 收 ¥{{ g.income.toFixed(2) }}</template>
          </span>
        </div>
        <van-swipe-cell v-for="item in g.items" :key="item.id">
          <van-cell :border="false" center>
            <template #icon>
              <div class="item-icon" :style="{ background: store.categoryOf(item.categoryId).color }">
                {{ store.categoryOf(item.categoryId).icon }}
              </div>
            </template>
            <template #title>
              <div class="item-title">{{ store.categoryOf(item.categoryId).name }}</div>
              <div v-if="item.note" class="item-note">{{ item.note }}</div>
            </template>
            <template #value>
              <div :class="['item-amount', item.type]">
                {{ item.type === 'expense' ? '-' : '+' }}{{ item.amount.toFixed(2) }}
              </div>
            </template>
          </van-cell>
          <template #right>
            <van-button square type="danger" text="删除" class="delete-btn" @click="onDelete(item)" />
          </template>
        </van-swipe-cell>
      </div>
    </div>

    <div v-else class="empty-tip">还没有记录，点下面按钮记第一笔</div>

    <!-- 记一笔 -->
    <div class="fab-wrap">
      <van-button round block type="primary" icon="plus" @click="openAdd">记一笔</van-button>
    </div>

    <!-- 添加弹窗 -->
    <van-popup v-model:show="showAdd" position="bottom" round :style="{ paddingBottom: '16px' }">
      <div class="popup-title">记一笔</div>

      <van-tabs v-model:active="form.type" type="card" class="type-tabs">
        <van-tab title="支出" name="expense" />
        <van-tab title="收入" name="income" />
      </van-tabs>

      <van-field
        v-model="form.amount"
        type="number"
        label="金额"
        placeholder="0.00"
        input-align="right"
        class="amount-field"
      >
        <template #left-icon><span class="yuan">¥</span></template>
      </van-field>

      <div class="cat-picker">
        <div
          v-for="c in store.categories"
          :key="c.id"
          :class="['cat-chip', { active: form.categoryId === c.id }]"
          :style="form.categoryId === c.id ? { background: c.color, borderColor: c.color, color: '#fff' } : {}"
          @click="onPickCategory(c.id)"
        >
          {{ c.icon }} {{ c.name }}
        </div>
      </div>

      <van-field v-model="form.note" label="备注" placeholder="选填" maxlength="40" />

      <div class="popup-actions">
        <van-button block plain @click="showAdd = false">取消</van-button>
        <van-button block type="primary" :disabled="!canSubmit" @click="onSubmit">保存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { useLedgerStore } from '@/stores/ledger'

const store = useLedgerStore()
const showAdd = ref(false)

const form = reactive({
  type: 'expense' as 'expense' | 'income',
  amount: '',
  categoryId: '',
  note: '',
})

const canSubmit = computed(() => Number(form.amount) > 0 && !!form.categoryId)

function openAdd() {
  form.type = 'expense'
  form.amount = ''
  form.note = ''
  form.categoryId = store.categories[0]?.id || ''
  showAdd.value = true
}

/** 轻量震动反馈：打包成 App 后有效，浏览器里会被忽略 */
async function tapFeedback() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* 浏览器环境无震动 */
  }
}

async function onPickCategory(id: string) {
  form.categoryId = id
  await tapFeedback()
}

async function onSubmit() {
  store.addRecord({
    type: form.type,
    amount: Number(Number(form.amount).toFixed(2)),
    categoryId: form.categoryId,
    note: form.note.trim(),
  })
  showAdd.value = false
  showToast('已记录')
  await tapFeedback()
}

async function onDelete(item: { id: string }) {
  await showConfirmDialog({ title: '确认删除', message: '删掉之后找不回来了' })
    .then(() => {
      store.removeRecord(item.id)
      showToast('已删除')
    })
    .catch(() => {
      /* 用户取消 */
    })
}

onMounted(() => {
  if (!store.categories.length) store.loadContent()
})
</script>

<style scoped>
.summary {
  padding: 20px 16px;
  background: linear-gradient(135deg, #1989fa 0%, #4facfe 100%);
  color: #fff;
}
.summary-label {
  font-size: 13px;
  opacity: 0.85;
}
.summary-value {
  margin-top: 4px;
  font-size: 30px;
  font-weight: 700;
}
.summary-side {
  display: flex;
  gap: 24px;
  margin-top: 14px;
  font-size: 13px;
}
.side-label {
  margin-right: 6px;
  opacity: 0.85;
}
.side-value {
  font-weight: 600;
}
.section-label {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.ratio-bar {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 5px;
  background: #ebedf0;
}
.ratio-seg {
  height: 100%;
  transition: width 0.3s;
}
.legend {
  margin-top: 12px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 13px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.legend-name {
  flex: 1;
  color: #646566;
}
.legend-amount {
  color: #323233;
}
.legend-percent {
  width: 40px;
  text-align: right;
  color: #969799;
}
.records {
  margin-top: 12px;
}
.day-group {
  margin-bottom: 12px;
  background: #fff;
}
.day-header {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 12px;
  color: #969799;
  background: #fafafa;
}
.day-sum {
  color: #969799;
}
.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-right: 12px;
  border-radius: 50%;
  font-size: 17px;
}
.item-title {
  font-size: 14px;
  color: #323233;
}
.item-note {
  margin-top: 2px;
  font-size: 12px;
  color: #969799;
}
.item-amount {
  font-size: 15px;
  font-weight: 600;
}
.item-amount.expense {
  color: #323233;
}
.item-amount.income {
  color: #07c160;
}
.delete-btn {
  height: 100%;
}
.fab-wrap {
  position: fixed;
  right: 16px;
  bottom: calc(66px + env(safe-area-inset-bottom, 0px));
  left: 16px;
  z-index: 10;
}
.popup-title {
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}
.type-tabs {
  margin: 0 16px 8px;
}
.yuan {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}
.amount-field :deep(input) {
  font-size: 22px !important;
  font-weight: 600;
}
.cat-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
}
.cat-chip {
  padding: 6px 12px;
  border: 1px solid #ebedf0;
  border-radius: 16px;
  font-size: 13px;
  color: #646566;
  transition: all 0.2s;
}
.popup-actions {
  display: flex;
  gap: 12px;
  padding: 8px 16px 0;
}
</style>
