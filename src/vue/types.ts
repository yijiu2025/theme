/**
 * 调试面板的**数据契约**
 *
 * 面板被抽进主题库后，就不能再自己 `useRoute()` / `useThemeStore()` 了 ——
 * 那是宿主的框架与业务。现在它只认这份契约：**宿主算好模型、给出动作**，
 * 面板负责渲染与交互。于是：
 *   • 任何前端（乃至别的框架包壳）都能复用同一个面板；
 *   • 面板的行为可以在单测里用一组假数据完整覆盖，不需要起真路由。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import type { ThemeMode } from '../mode';
import type { ThemeTone } from '../tone';

/** 一张色卡 */
export interface ThemeDebugColor {
  /** 配色 id（目录名） */
  id: string;
  /** 中文显示名 */
  name: string;
  /** 系别（白系 / 黑系） */
  tone: ThemeTone;
  /** 色卡底色（`#rrggbb`）；缺省用中性灰兜底 */
  preview?: string;
}

/** 面板要渲染的**全部**状态 */
export interface ThemeDebugModel {
  /** 当前页面名；该页未接入版式机制时留空（面板不显示版式行） */
  page?: string;
  /** 可选设备清单（宿主声明） */
  devices: readonly string[];
  /** 设备显示名；缺省直接用 id */
  deviceLabels?: Readonly<Record<string, string>>;
  /** 当前**生效**设备（渲染形态决定的那个） */
  device: string;
  /** 面板手动覆盖的设备；`null` = 跟随页面 */
  deviceOverride: string | null;
  /** 当前页可选版式（= 可选主题包） */
  views: string[];
  /** 当前生效版式 */
  view: string;
  /** 该页还有哪些版式挂了配色（用于提示"切过去颜色会变"） */
  viewsWithColors?: string[];
  /** 当前版式支持的配色 */
  colors: ThemeDebugColor[];
  /** 当前**生效**配色 id */
  color: string;
  /** 用户显式选过、但当前作用域落不到它时用于「选择 → 生效」提示 */
  selectedColor?: string;
  /** 明暗意图 */
  mode: ThemeMode;
}

/** 面板能触发的**全部**动作 */
export interface ThemeDebugActions {
  /** 覆盖设备；传 `null` 表示跟随页面 */
  pickDevice(device: string | null): void;
  /** 切换版式（宿主负责改 URL，面板不碰路由） */
  pickView(id: string): void;
  /** 切换配色 */
  pickColor(id: string): void;
  /** 切换明暗意图 */
  pickMode(mode: ThemeMode): void;
  /** 恢复默认 */
  reset(): void;
}
