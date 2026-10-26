<script setup lang="ts">
/**
 * 调试面板主体（真正的 UI + 数据 + 动作）
 *
 * 与门卫（ThemeDebugPanel.vue）配套：只有门卫 visible 时才被异步加载 ——
 * off 档连 chunk 都不进产物。数据与动作由 useThemeDebugPanel() 自动组装，宿主零接线。
 *
 * 不限定只在开发构建出现：真机没有 DevTools，线上排查时能切主题看效果是刚需；
 * 面板内容只有主题名与色值，不构成信息泄露。
 *
 * 样式刻意不跟随宿主主题：面板是用来对比的，固定深色、完全不透明；
 * scoped CSS 而不是 Tailwind（库不能假定宿主装了 Tailwind）。
 *
 * 颜色与明暗正交：点颜色纯换配色、不碰明暗；明暗只由「明暗」行控制（有单向联动）。
 * 结构：版式 → 颜色（当前版式支持的，切版式会变）→ 明暗 → 恢复默认。
 */
import { computed, ref } from 'vue';
import { MODE_LABELS, TONE_LABELS } from '../../scheme';
import { useThemeDebugPanel } from '../composables/useThemeDebugPanel';
import type { ThemeDebugColor } from '../types';

const TITLE = '主题调试';
const HINT = '?debug=theme';

const { model, actions } = useThemeDebugPanel();

/** 本次会话内手动关掉（宿主仍按 URL 参数控制可见性，刷新会回来） */
const dismissed = ref(false);

/** 折叠态：默认按视口高度判（弹窗场景真正的约束是高度，不是宽度） */
const COMPACT_MAX_HEIGHT = 560;
const collapsed = ref(
  typeof window !== 'undefined' && window.innerHeight < COMPACT_MAX_HEIGHT
);

const deviceLabel = (device: string): string => model.value.deviceLabels?.[device] ?? device;

/** 面板头部状态串（配色 · 系别 · 明暗，联调时一眼确认联动是否生效） */
const headerState = computed(() => {
  const m = model.value;
  const name = m.colors.find(c => c.id === m.color)?.name ?? m.color;
  const tone = m.colors.find(c => c.id === m.color)?.tone ?? 'light';
  const parts = [name, TONE_LABELS[tone], MODE_LABELS[m.mode]];
  const selected = m.selectedColor;
  if (selected && selected !== m.color) {
    const selName = m.colors.find(c => c.id === selected)?.name ?? selected;
    parts.push(`选择 ${selName} → 生效 ${name}`);
  }
  return parts.join(' · ');
});

/** 该页还有别的版式挂了颜色（提示"切过去颜色清单会变"） */
const otherViewsWithColors = computed(() =>
  (model.value.viewsWithColors ?? []).filter(v => v !== model.value.view)
);

/** 把 #rrggbb 解析成三元组；非法值返回 null */
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 色卡底色：取色卡的 preview；取不到时给中性灰兜底（不透明，避免穿帮） */
function swatchBg(item: ThemeDebugColor): string {
  return item.preview ?? '#334155';
}

/** 色块上的文字色：按底色亮度选黑/白，保证任何色卡上都读得清 */
function swatchFg(item: ThemeDebugColor): string {
  const rgb = item.preview ? parseHex(item.preview) : null;
  if (!rgb) return '#e2e8f0';
  // 相对亮度（sRGB 感知近似：0.299R + 0.587G + 0.114B）
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return lum > 150 ? '#0f172a' : '#f8fafc';
}

const MODES = ['system', 'light', 'dark'] as const;
</script>

<template>
  <div
    v-if="!dismissed"
    data-mauth-debug="theme"
    class="tdp-root"
    role="region"
    :aria-label="TITLE"
  >
    <!-- 头部：标题 + 当前状态 + 折叠/关闭 -->
    <div class="tdp-header">
      <button
        type="button"
        class="tdp-toggle"
        :aria-expanded="!collapsed"
        aria-controls="tdp-body"
        @click="collapsed = !collapsed"
      >
        <span class="tdp-caret">{{ collapsed ? '▸' : '▾' }}</span>
        <span class="tdp-title">{{ TITLE }}</span>
        <span class="tdp-state">{{ headerState }}</span>
      </button>
      <button
        type="button"
        class="tdp-close"
        aria-label="收起面板"
        title="收起面板（URL 参数仍在，刷新会回来）"
        @click="dismissed = true"
      >
        ×
      </button>
    </div>

    <div id="tdp-body" v-if="!collapsed" class="tdp-body">
      <!-- 设备：同一台电脑上预览另一端（不必真去开移动端路由） -->
      <div class="tdp-row">
        <span class="tdp-label" id="tdp-device-label">设备</span>
        <div class="tdp-seg" role="group" aria-labelledby="tdp-device-label">
          <button
            type="button"
            class="tdp-seg-item"
            :class="{ 'is-on': model.deviceOverride === null }"
            :aria-pressed="model.deviceOverride === null"
            data-device="auto"
            :title="`跟随页面（当前 ${deviceLabel(model.device)}）`"
            @click="actions.pickDevice(null)"
          >
            跟随
          </button>
          <button
            v-for="d in model.devices"
            :key="d"
            type="button"
            class="tdp-seg-item"
            :class="{ 'is-on': model.deviceOverride === d }"
            :aria-pressed="model.deviceOverride === d"
            :data-device="d"
            @click="actions.pickDevice(d)"
          >
            {{ deviceLabel(d) }}
          </button>
        </div>
      </div>

      <!-- ① 版式（当前页） -->
      <div v-if="model.views.length" class="tdp-block">
        <div class="tdp-block-head">
          <span class="tdp-label">版式</span>
          <span class="tdp-note">
            {{ model.page }}{{ model.views.length > 1 ? '' : '（仅此一种版式）' }}
          </span>
        </div>
        <div class="tdp-chips">
          <button
            v-for="id in model.views"
            :key="id"
            type="button"
            class="tdp-chip"
            :class="{ 'is-on': model.view === id }"
            :aria-pressed="model.view === id"
            :data-view-id="id"
            :title="`切到版式 ${id}`"
            @click="actions.pickView(id)"
          >
            {{ id }}
          </button>
        </div>
        <p v-if="otherViewsWithColors.length" class="tdp-hint">
          另有版式 {{ otherViewsWithColors.join('、') }} 可选
        </p>
      </div>

      <!-- ② 颜色（**当前版式**支持的那几种） -->
      <div class="tdp-block">
        <div class="tdp-block-head">
          <span class="tdp-label">颜色</span>
          <span class="tdp-note">版式 {{ model.view }} · {{ model.colors.length }} 种</span>
        </div>
        <div v-if="model.colors.length" class="tdp-swatches">
          <button
            v-for="c in model.colors"
            :key="c.id"
            type="button"
            class="tdp-swatch"
            :class="{ 'is-on': model.color === c.id }"
            :aria-pressed="model.color === c.id"
            :aria-label="`${c.name}（${c.id} · ${TONE_LABELS[c.tone]}）`"
            :data-color-pick="c.id"
            :data-color-active="model.color === c.id ? c.id : undefined"
            :data-tone="c.tone"
            :title="`${c.name}（${c.id} · ${TONE_LABELS[c.tone]}）`"
            @click="actions.pickColor(c.id)"
          >
            <span class="tdp-swatch-chip" :style="{ background: swatchBg(c), color: swatchFg(c) }">
              {{ c.name }}
            </span>
            <span class="tdp-swatch-id">{{ c.id }}·{{ TONE_LABELS[c.tone] }}</span>
          </button>
        </div>
        <p v-else class="tdp-hint">这个版式还没有配色目录（`themes/…/{{ model.page }}/…/colors/`）</p>
      </div>

      <!-- ③ 明暗（切明暗会**单向**联动配色系别；点颜色不改明暗） -->
      <div class="tdp-mode">
        <span class="tdp-label" id="tdp-mode-label">明暗</span>
        <div class="tdp-seg" role="group" aria-labelledby="tdp-mode-label">
          <button
            v-for="m in MODES"
            :key="m"
            type="button"
            class="tdp-seg-item"
            :class="{ 'is-on': model.mode === m }"
            :aria-pressed="model.mode === m"
            :data-mode="m"
            @click="actions.pickMode(m)"
          >
            {{ MODE_LABELS[m] }}
          </button>
        </div>
      </div>

      <div class="tdp-foot">
        <button type="button" class="tdp-chip" @click="actions.reset()">恢复默认</button>
        <span class="tdp-note">{{ HINT }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * 固定深色、不透明：面板是"参照物"，跟着主题变色就失去意义。
 * 颜色全部写死在这里（不取宿主 token），也不依赖任何 CSS 框架。
 */
.tdp-root {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  width: 264px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  overflow: hidden;
  border: 1px solid #334155;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  box-shadow: 0 20px 40px rgb(0 0 0 / 45%);
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    'PingFang SC',
    'Microsoft YaHei',
    sans-serif;
  font-size: 12px;
  line-height: 1.4;
}

.tdp-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid rgb(51 65 85 / 70%);
}

.tdp-toggle {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tdp-caret,
.tdp-title {
  flex-shrink: 0;
}

.tdp-caret {
  color: #94a3b8;
}

.tdp-title {
  font-size: 12px;
  font-weight: 500;
  color: #f1f5f9;
}

.tdp-state {
  overflow: hidden;
  color: #94a3b8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tdp-close {
  flex-shrink: 0;
  padding: 0 4px;
  border: 0;
  background: none;
  color: #64748b;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.tdp-close:hover {
  color: #e2e8f0;
}

.tdp-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px 10px;
}

.tdp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.tdp-block {
  margin-top: 10px;
}

.tdp-block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
}

.tdp-label {
  color: #94a3b8;
  font-size: 11px;
}

.tdp-note {
  overflow: hidden;
  padding-left: 8px;
  color: #64748b;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tdp-hint {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 10px;
  line-height: 1.5;
}

/* 分段控件（设备 / 明暗） */
.tdp-seg {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tdp-seg-item {
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: #64748b;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.tdp-seg-item:hover {
  color: #cbd5e1;
}

.tdp-seg-item.is-on {
  background: rgb(56 189 248 / 20%);
  color: #f1f5f9;
}

/* 版式 chip */
.tdp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tdp-chip {
  padding: 2px 8px;
  border: 1px solid #334155;
  border-radius: 999px;
  background: none;
  color: #94a3b8;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.tdp-chip:hover {
  background: rgb(241 245 249 / 10%);
}

.tdp-chip.is-on {
  border-color: rgb(56 189 248 / 70%);
  background: rgb(56 189 248 / 15%);
  color: #f1f5f9;
}

/* 色卡 */
.tdp-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tdp-swatch {
  display: flex;
  width: 46px;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 2px 0;
  border: 1px solid #334155;
  border-radius: 6px;
  background: none;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.tdp-swatch:hover {
  border-color: #64748b;
}

.tdp-swatch.is-on {
  border-color: rgb(56 189 248 / 80%);
  box-shadow: 0 0 0 1px rgb(56 189 248 / 60%);
}

.tdp-swatch-chip {
  display: flex;
  width: 38px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.tdp-swatch-id {
  max-width: 42px;
  overflow: hidden;
  color: #64748b;
  font-size: 9px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 明暗 */
.tdp-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 4px 8px;
  border: 1px solid rgb(51 65 85 / 60%);
  border-radius: 8px;
}

.tdp-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgb(51 65 85 / 70%);
}
</style>
