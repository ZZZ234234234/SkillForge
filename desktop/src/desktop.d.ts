/** 预加载脚本注入到窗口的桌面能力；类型与 src/features/local/bridge.ts 保持一致。 */
import type { DesktopApi } from "../../src/features/local/bridge";

declare global {
  interface Window {
    skillforgeDesktop?: DesktopApi;
  }
}

export {};
