import { client } from "./client";

export const diagramsApi = {
  list: () => client.get("/diagrams").then((r) => r.data.items),
  get: (id) => client.get(`/diagrams/${id}`).then((r) => r.data),
  create: (diagram) => client.post("/diagrams", diagram).then((r) => r.data),
  update: (id, diagram) =>
    client.put(`/diagrams/${id}`, diagram).then((r) => r.data),
  remove: (id) => client.delete(`/diagrams/${id}`).then(() => true),
};
