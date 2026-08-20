// 简版事件总线：用于在 diagrams/templates 增删改后通知列表组件刷新
// 替代原来 Dexie useLiveQuery 的实时性能力。
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(topic) {
  for (const fn of listeners) {
    try {
      fn(topic);
    } catch (e) {
      console.warn("store bus listener error", e);
    }
  }
}

export const TOPICS = {
  DIAGRAMS_CHANGED: "diagrams:changed",
  TEMPLATES_CHANGED: "templates:changed",
};
