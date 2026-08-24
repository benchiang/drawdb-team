import { parseDbml } from "../dbml/parse";
import { reconcileDbml } from "../dbml/reconcile";

export async function fromDBML(src, database) {
  const parsed = await parseDbml(src);
  return reconcileDbml(parsed, null, database);
}
