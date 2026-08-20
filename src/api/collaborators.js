import { client } from "./client";

export const collaboratorsApi = {
  list: (diagramId) =>
    client
      .get(`/diagrams/${diagramId}/collaborators`)
      .then((r) => r.data.items),
  add: (diagramId, username, permission = "edit") =>
    client
      .post(`/diagrams/${diagramId}/collaborators`, { username, permission })
      .then((r) => r.data),
  /**
   * 修改协作者权限：permission ∈ 'read' | 'edit'
   */
  updatePermission: (diagramId, userId, permission) =>
    client
      .patch(`/diagrams/${diagramId}/collaborators/${userId}`, { permission })
      .then((r) => r.data),
  remove: (diagramId, userId) =>
    client.delete(`/diagrams/${diagramId}/collaborators/${userId}`).then(() => true),
};
