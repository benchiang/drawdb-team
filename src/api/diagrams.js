import { client } from "./client";

export const diagramsApi = {
  list: () => client.get("/diagrams").then((r) => r.data.items),
  listTrashed: () => client.get("/diagrams/trash").then((r) => r.data.items),
  get: (id) => client.get(`/diagrams/${id}`).then((r) => r.data),
  create: (diagram) => client.post("/diagrams", diagram).then((r) => r.data),
  update: (id, diagram) =>
    client.put(`/diagrams/${id}`, diagram).then((r) => r.data),
  // 软删除：图表移入回收站，可通过 restore() 恢复
  remove: (id) => client.delete(`/diagrams/${id}`).then(() => true),
  restore: (id) => client.post(`/diagrams/${id}/restore`).then((r) => r.data),
  permanentDelete: (id) =>
    client.delete(`/diagrams/${id}/permanent`).then(() => true),
};
