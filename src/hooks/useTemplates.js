import { useEffect, useState, useCallback } from "react";
import { templatesApi } from "../api/templates";
import { subscribe, TOPICS, emit } from "../api/storeBus";
import { templateSeeds } from "../data/seeds";
import { DB } from "../data/constants";

export function useTemplates(custom) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await templatesApi.list(custom);
      setItems(list || []);
    } catch (err) {
      console.warn("load templates failed", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [custom]);

  useEffect(() => {
    reload();
    const unsubscribe = subscribe((topic) => {
      if (topic === TOPICS.TEMPLATES_CHANGED) reload();
    });
    return unsubscribe;
  }, [reload]);

  return { items, loading, reload };
}

// 首次启动时若 templates 表为空，把 seed 模板推送到 server。
// 一次性操作，完成后通过 storeBus 通知其他组件刷新。
export async function seedDefaultTemplatesIfEmpty() {
  try {
    const existing = await templatesApi.list();
    if (existing && existing.length > 0) return;
    for (const tpl of templateSeeds) {
      // 历史种子数据缺 database 字段，注入 generic 兜底
      const tplDatabase = tpl.database || DB.GENERIC;
      await templatesApi.create({
        templateId: tpl.templateId,
        title: tpl.title,
        database: tplDatabase,
        custom: 0,
        tables: tpl.tables,
        relationships: tpl.relationships,
        notes: tpl.notes,
        subjectAreas: tpl.subjectAreas,
        enums: tpl.enums,
        types: tpl.types,
      });
    }
    emit(TOPICS.TEMPLATES_CHANGED);
  } catch (err) {
    console.warn("seed default templates failed", err);
  }
}
