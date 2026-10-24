/**
 * 作用域主题注入（composable 半边）—— 把某份配色记录注入到**给定元素**（P1a，2026-10-23）
 *
 * 与全局注入（`theme-runtime` 写 html 根）的三个本质差异：
 *   1. 解析走内核纯查询（`getThemeRecord`），**不读不写 store 的 activePage/activeDevice** ——
 *      同屏多主题各自解析，互不干扰，全局作用域纹丝不动（这是 P1b `<ThemePart>` 不劫持
 *      背景的根基，见计划 §一「陷阱」）；
 *   2. 注入目标是调用方给的元素（token 只沿 DOM 子树继承），不是 html 根；
 *   3. `dark` 类与 `data-mauth-theme` 属性挂在**该元素**上（Tailwind v4 的
 *      `.dark, .dark *` 策略下子树可命中 `dark:` 变体；基线 SCSS 的 `html.dark` 块不进
 *      作用域 —— 作用域配色自带完整底色 token，这是 2026-09-25「配色自带底色」定案的落点）。
 *
 * 消费方：`ThemeProvider.vue`（钉死/并行主题容器）、`ThemePart.vue` 的 `color-id` 档。
 * 返回 cleanup：卸载时精确摘除自己写过的变量（差集账本在 `token-runtime` 的 WeakMap 里）。
 *
 * ⚠️ 作用域 = **tokens-only**：`theme.scss` 不进作用域（它的选择器契约是
 *    `html[data-mauth-theme]` 前缀）—— 计划 §2.2 ③ 的刻意边界。
 *
 * @author yijiu2025
 * @since 2026-10-23（计划 §2.2 P1a ②）
 */
import { watch } from 'vue';
import type { Ref } from 'vue';
import { DEFAULT_THEME_PACKAGE } from '../../constants';
import { getDefaultThemeId, getThemeRecord } from '../../registry';
import type { MauthThemeRecord } from '../../types';
import { applyThemeLayers, clearThemeTokens } from '../runtime/token-runtime';

/** 作用域解析的输入（`pkg`/`colorId` 都可缺省，见 `resolveScopedRecord`） */
export interface ScopedThemeParams {
  /** 页面名（作用域配色归属 = 包 × 设备 × 页面；部件的部件配色用 `part:<id>` 命名空间页） */
  page: string;
  /** 设备名 */
  device: string;
  /** 主题包（缺省 default 包） */
  pkg?: string;
  /**
   * 指定配色 id；缺省取该范围兜底色（`getDefaultThemeId`）
   * 🔴 指定了但解析不到时：dev 下警告（静默失败不靠猜），prod 静默回落兜底记录
   */
  colorId?: string;
}

/**
 * 解析作用域配色记录（纯查询，不碰 store）
 *
 * 回退链与 store 侧 `themeRecordFor` 同源（内核 `getThemeRecord`）：
 * 指定 id → 同系别首套 → 该范围兜底 → 空记录。
 */
export function resolveScopedRecord(params: ScopedThemeParams): MauthThemeRecord {
  const pkg = params.pkg ?? DEFAULT_THEME_PACKAGE;
  const id =
    params.colorId ??
    getDefaultThemeId({ device: params.device, page: params.page, pkg }) ??
    '';
  const record = getThemeRecord({ id, device: params.device, pkg, page: params.page });
  if (import.meta.env.DEV && params.colorId && record.meta.id !== params.colorId) {
    console.warn(
      `[theme] 作用域配色「${params.colorId}」在 包「${pkg}」× 设备「${params.device}」× ` +
        `页「${params.page}」下不存在，已回落「${record.meta.id || '空记录'}」` +
        '（计划 §四 Q2：静默失败 dev 显影，prod 兜底）'
    );
  }
  return record;
}

/**
 * 把作用域记录注入到 `el`（token + `data-mauth-theme` + `.dark` 类），返回 cleanup
 *
 * `record` 是响应源（Ref，可为 null）：null = **不注入**（`<ThemePart>` 未钉死配色时
 * 继承全局 token 的档位——watch 收到 null 时清理自己写过的痕迹即可）；外部换绑
 * （props 变化）时重算注入并做差集清理。
 */
export function useScopedTheme(
  record: Ref<MauthThemeRecord | null>,
  el: Ref<HTMLElement | null>
): () => void {
  const stop = watch(
    record,
    rec => {
      const node = el.value;
      if (!node) return;
      if (!rec || !rec.tokens) {
        // 未钉死 / 记录无 token：清干净自己写过的痕迹，回到"继承全局"档
        clearThemeTokens(node);
        node.classList.remove('dark');
        delete node.dataset.mauthTheme;
        return;
      }
      // token 注入（差集清理只动自己写过的名字；rejected 非空 = 有不合规值，已在 sanitize 时丢弃）
      const rejected = applyThemeLayers({ theme: rec.tokens }, { target: node });
      if (rejected.length > 0) {
        console.warn(`[theme] 作用域忽略了 ${rejected.length} 条不合规的主题变量：${rejected.join('、')}`);
      }
      // 配色标识：与全局同一属性名，但挂在本元素上（作用域内可用
      // `[data-mauth-theme='<id>']` 祖先选择器命中；`html[...]` 前缀契约的不进作用域）
      node.dataset.mauthTheme = rec.meta.id;
      // 作用域暗色：`.dark` 挂本元素（Tailwind v4 `.dark *` 策略子树可命中）
      node.classList.toggle('dark', rec.tone === 'dark');
    },
    { immediate: true }
  );

  return () => {
    stop();
    const node = el.value;
    if (node) {
      clearThemeTokens(node);
      node.classList.remove('dark');
      delete node.dataset.mauthTheme;
    }
  };
}
