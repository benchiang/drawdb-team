import { client } from "./client";

export const templatesApi = {
  list: (custom) => {
    const q = custom === undefined ? "" : `?custom=${custom}`;
    return client.get(`/templates${q}`).then((r) => r.data.items);
  },
  get: (id) => client.get(`/templates/${id}`).then((r) => r.data),
  create: (template) => client.post("/templates", template).then((r) => r.data),
  remove: (id) => client.delete(`/templates/${id}`).then(() => true),
};
