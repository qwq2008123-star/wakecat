import { ensureSeeded } from "./seed-data";

declare global {
  // eslint-disable-next-line no-var
  var __wxCatBootstrapped: Promise<void> | undefined;
}

/** 幂等引导:首次访问时自动建库、播种(演示数据带 is_demo 标记) */
export function ensureBootstrap(): Promise<void> {
  if (!globalThis.__wxCatBootstrapped) {
    globalThis.__wxCatBootstrapped = (async () => {
      ensureSeeded();
    })();
  }
  return globalThis.__wxCatBootstrapped;
}
