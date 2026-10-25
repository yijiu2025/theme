/**
 * 主题 store 的结构契约（库侧约定）+ provide / inject 键
 *
 * 库不能 import 宿主的 Pinia store（边界），所以只约定结构类型：宿主 store
 * 结构兼容即可传给 <ThemeRoot :themeStore>，由它 provide 出去、<ThemeView> /
 * <ThemeDebugPanel> inject —— 「库不依赖宿主、但宿主事实要注入」的标准手法。
 *
 * 字段用只读标量（宿主 Pinia 会自动解包 ref）；方法用方法签名（TS 双变检查，
 * 宿主的窄类型能兼容库的宽类型）。
 */
import type { InjectionKey } from 'vue';
import type { ThemeMode } from '../../scheme';
import type { DeviceVocab } from '../../types';

/** 主题 store 的结构契约（宿主 store 结构兼容即可传） */
export interface ThemeStoreLike {
  /** 装配期注入的设备词汇清单（调试面板的设备列表用；库不自持注册表） */
  readonly devices: readonly DeviceVocab[];
  /** 当前生效主题包名（= 版式 id，一个包一种版式） */
  readonly packageId: string;
  /** 当前是否深色（= 生效配色的系别） */
  readonly isDark: boolean;
  /** 当前生效页面名 */
  readonly activePage: string;
  /** 全局配色意图（用户显式选过的 id） */
  readonly themeId: string;
  /** 明暗意图 */
  readonly mode: ThemeMode;
  /** 某页当前声明式版式 id（主题包 `views.<page>` 声明；无声明返回 undefined） */
  viewFor(page: string, device?: string): string | undefined;
  /**
   * 某设备**显式指定**的版式 id（URL 一次读入 + debug 显式操作；专属键 > 通用键，
   * 都没有返回 null）—— ThemeView 的 URL 档数据源（2026-10-20 store 化）
   */
  deviceViewOf(device?: string): string | null;
  /** 显式设置某设备的版式（debug 面板用；只写 store，不写 URL、不落盘） */
  setDeviceView(device: string, id: string): void;
  /** 清掉某设备被 URL 显式指定的版式意图（用户的显式操作前调用，如 debug 选回生效版式） */
  clearDeviceViewOverride(device?: string): void;
  /** 告知 store「当前是哪一页、哪套版式」（配色挂在版式下，token 注入依赖它） */
  setActivePageView(page: string, viewId: string): void;
  /**
   * 当前生效设备 —— 由 `<ThemeView page="…" device="…">` props 告知（2026-10-20：
   * 库不自行判定，这是 ThemeView 与调试面板共同读取的值）
   */
  readonly activeDevice: string;
  /** 告知 store「当前渲染视图属于哪台设备」（ThemeView 的写入口；判定逻辑在宿主分发器） */
  setActiveDevice(device: string): void;
  /** 按包/设备/页解析生效配色记录（含 URL 设备覆盖；面板只要 `meta.id` 与 `tone`） */
  themeRecordFor(pkg?: string, device?: string, page?: string): {
    meta: { id: string };
    tone?: string;
  };
  /** 设置配色（落盘；面板点色卡用） */
  setTheme(id: string): void;
  /** 设置明暗意图（面板切明暗用） */
  setMode(mode: ThemeMode): void;
}

/** `provide`/`inject` 用的键（`<ThemeRoot>` provide，`<ThemeView>` / `<ThemeDebugPanel>` inject） */
export const themeStoreKey: InjectionKey<ThemeStoreLike> = Symbol('mauth.themeStore');
