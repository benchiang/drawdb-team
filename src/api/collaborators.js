import { client } from "./client";

export const collaboratorsApi = {
  list: (diagramId) =>
    client
      .get(`/diagrams/${diagramId}/collaborators`)
      .then((r) => r.data.items),
  add: (diagramId, username) =>
    client
      .post(`/diagrams/${diagramId}/collaborators`, { username })
      .then((r) => r.data),
  remove: (diagramId, userId) =>
    client.delete(`/diagrams/${diagramId}/collaborators/${userId}`).then(() => true),
};
