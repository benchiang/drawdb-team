import { client } from "./client";

export const authApi = {
  bootstrapStatus: () => client.get("/auth/bootstrap").then((r) => r.data),
  bootstrapCreate: (username, password) =>
    client
      .post("/auth/bootstrap", { username, password })
      .then((r) => r.data),
};

export const usersApi = {
  list: () => client.get("/users").then((r) => r.data.items),
  create: (payload) => client.post("/users", payload).then((r) => r.data),
  update: (id, payload) => client.patch(`/users/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/users/${id}`).then(() => true),
  search: (q) =>
    client
      .get("/users/search", { params: { q } })
      .then((r) => r.data.items || []),
};
