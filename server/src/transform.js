// 通用工具：把 DB 行（payload 是 JSON 字符串）解组成前端期望的对象
export function rowToDiagram(row) {
  if (!row) return null;
  let payload = {};
  try {
    payload = JSON.parse(row.payload);
  } catch {
    payload = {};
  }
  return {
    diagramId: row.id,
    name: row.name,
    database: row.database,
    gistId: row.gist_id,
    loadedFromGistId: row.loaded_from_gist_id,
    lastModified: row.last_modified,
    ...payload,
  };
}

export function diagramToRow(body) {
  // 把表字段之外的业务字段塞进 payload JSON
  const {
    diagramId,
    name,
    database,
    gistId,
    loadedFromGistId,
    lastModified,
    tables,
    references,
    notes,
    areas,
    pan,
    zoom,
    enums,
    types,
  } = body;
  return {
    id: diagramId,
    name,
    database,
    gist_id: gistId ?? null,
    loaded_from_gist_id: loadedFromGistId ?? null,
    last_modified: lastModified || new Date().toISOString(),
    payload: JSON.stringify({ tables, references, notes, areas, pan, zoom, enums, types }),
  };
}

export function rowToTemplate(row) {
  if (!row) return null;
  let payload = {};
  try {
    payload = JSON.parse(row.payload);
  } catch {
    payload = {};
  }
  return {
    templateId: row.id,
    title: row.title,
    database: row.database,
    custom: row.custom,
    ...payload,
  };
}

export function templateToRow(body) {
  const {
    templateId,
    title,
    database,
    custom,
    tables,
    relationships,
    notes,
    subjectAreas,
    enums,
    types,
  } = body;
  return {
    id: templateId,
    title,
    database,
    custom: custom ?? 0,
    payload: JSON.stringify({
      tables,
      relationships,
      notes,
      subjectAreas,
      enums,
      types,
    }),
  };
}
