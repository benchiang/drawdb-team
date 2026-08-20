// 原 Dexie 入口已弃用：数据现在通过 /api/diagrams 与 /api/templates 走 HTTP。
// 这里保留空导出，避免历史 import 报错。新代码请直接使用：
//   import { diagramsApi } from "../api/diagrams";
//   import { templatesApi } from "../api/templates";
import { diagramsApi } from "../api/diagrams";
import { templatesApi } from "../api/templates";
import { TOPICS, emit } from "../api/storeBus";

// 兼容旧 API：db.diagrams / db.templates 的最小子集。
// 注意：这些是同步 shim，仅用于过渡，未来应被新 API 完全替代。
export const db = {
  diagrams: {
    toArray: () => diagramsApi.list(),
    get: (q) => {
      if (q && typeof q === "object" && "loadedFromGistId" in q) {
        return diagramsApi
          .list()
          .then((items) =>
            items.find((d) => d.loadedFromGistId === q.loadedFromGistId) ||
            null,
          );
      }
      return Promise.resolve(null);
    },
    where: (key) => ({
      equals: (val) => ({
        first: () => diagramsApi
          .list()
          .then((items) =>
            key === "diagramId"
              ? items.find((d) => d.diagramId === val) || null
              : null,
          ),
        modify: () => {
          // 不在 shim 实现修改逻辑，请改用 diagramsApi.update
          return Promise.resolve(0);
        },
        delete: () => diagramsApi.remove(val).then(() => 1),
      }),
      get: () => {
        // 兼容 db.diagrams.get({loadedFromGistId: shareId}) 的 where().get() 链
        return Promise.resolve(null);
      },
    }),
    orderBy: (key) => ({
      last: () =>
        diagramsApi
          .list()
          .then((items) => {
            if (key === "lastModified") {
              return items
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.lastModified).getTime() -
                    new Date(a.lastModified).getTime(),
                )[0] || null;
            }
            return null;
          }),
    }),
    add: (diagram) => {
      emit(TOPICS.DIAGRAMS_CHANGED);
      return diagramsApi.create(diagram);
    },
    each: async (fn) => {
      const items = await diagramsApi.list();
      for (const item of items) {
        // 保留 Dexie 风格的回调：fn(item) 返回 false 终止
        if (await fn(item)) continue;
        break;
      }
    },
  },
  templates: {
    toArray: () => templatesApi.list(),
    where: (q) => {
      let promise;
      if (q && typeof q === "object" && "custom" in q) {
        promise = templatesApi.list(q.custom);
      } else {
        promise = templatesApi.list();
      }
      return {
        toArray: () => promise,
        equals: (val) => ({
          first: () =>
            promise.then((items) => items.find((t) => t.templateId === val) || null),
        }),
        each: async (fn) => {
          const items = await promise;
          for (const item of items) {
            if (await fn(item)) continue;
            break;
          }
        },
      };
    },
    add: (template) => {
      emit(TOPICS.TEMPLATES_CHANGED);
      return templatesApi.create(template);
    },
    delete: (id) => {
      emit(TOPICS.TEMPLATES_CHANGED);
      return templatesApi.remove(id);
    },
  },
};

export default db;
