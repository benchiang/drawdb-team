import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transformWithOxc } from "vite";
import * as constants from "../../../data/constants.js";

const noop = () => {};
const element = (type, props, ...children) => ({
  type,
  props: { ...props, children },
});

// 隔离 React 钩子和 UI 外壳，执行真实组件的父子传参及事件回调。
async function loadComponent(file, bindings) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const { code } = await transformWithOxc(
    source.replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, ""),
    file,
    { jsx: { runtime: "classic", pragma: "element" } },
  );
  return new Function(
    ...Object.keys(bindings),
    code.replace("export default function", "return function"),
  )(...Object.values(bindings));
}

function find(node, predicate) {
  if (!node || typeof node !== "object") return;
  if (predicate(node)) return node;
  for (const child of Object.values(node).flat()) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

async function harness(indices = []) {
  let table = {
    id: "table-id",
    name: "accounts",
    fields: [
      { id: "field-id", name: "email" },
      { id: "second-field-id", name: "tenant_id" },
    ],
    indices,
    uniqueConstraints: [],
  };
  let undoStack = [];
  let redoStack = [];
  let nextId = 0;
  const bindings = {
    ...constants,
    element,
    localStorage: { getItem: () => "1" },
    useState: (initial) => [
      typeof initial === "function" ? initial() : initial,
      noop,
    ],
    useMemo: (factory) => factory(),
    useTranslation: () => ({ t: (key) => key }),
    useLayout: () => ({ layout: { readOnly: false } }),
    useSaveState: () => ({ setSaveState: noop }),
    useSelect: () => ({ setSelectedElement: noop }),
    useDiagram: () => ({
      tables: [table],
      database: constants.DB.POSTGRES,
      updateTable: (id, values) => {
        assert.equal(id, table.id);
        table = { ...table, ...values };
      },
    }),
    useUndoRedo: () => ({
      undoStack,
      redoStack,
      setUndoStack: (fn) => {
        undoStack = fn(undoStack);
      },
      setRedoStack: (value) => {
        redoStack = typeof value === "function" ? value(redoStack) : value;
      },
    }),
    nanoid: () => `index-${nextId++}`,
    Collapse: { Panel: "Collapse.Panel" },
    Dropdown: { Menu: "Dropdown.Menu", Item: "Dropdown.Item" },
    ...Object.fromEntries(
      [
        "Input",
        "Button",
        "Popover",
        "Checkbox",
        "Select",
        "TextArea",
        "Card",
        "Modal",
        "IconMore",
        "IconDeleteStroked",
        "IconCopyStroked",
        "IconPlus",
        "IconAlertTriangle",
        "TableField",
        "SortableList",
        "ColorPicker",
        "IndexDetails",
        "UniqueConstraintDetails",
      ].map((name) => [name, name]),
    ),
  };
  const TableInfo = await loadComponent("./TableInfo.jsx", bindings);
  const Footer = await loadComponent("./TableInfoFooter.jsx", bindings);
  const IndexDetails = await loadComponent("./IndexDetails.jsx", bindings);
  const UniqueDetails = await loadComponent(
    "./UniqueConstraintDetails.jsx",
    bindings,
  );
  const controlSource = await readFile(
    new URL("../../EditorHeader/ControlPanel.jsx", import.meta.url),
    "utf8",
  );
  // 执行控制面板的真实历史闭包，不复制撤销/重做业务逻辑。
  const historySource = controlSource.slice(
    controlSource.indexOf("  const undo = () => {"),
    controlSource.indexOf("  const fileImport ="),
  );
  assert.ok(historySource.includes("const redo ="));
  function history(action) {
    const env = {
      ...constants,
      ...bindings.useDiagram(),
      ...bindings.useUndoRedo(),
    };
    new Function(...Object.keys(env), `${historySource}\n${action}();`)(
      ...Object.values(env),
    );
  }
  function editor(position, unique = false) {
    const tree = TableInfo({ data: table });
    const name = unique ? "UniqueConstraintDetails" : "IndexDetails";
    const rows = unique ? table.uniqueConstraints : table.indices;
    const row = find(
      tree,
      (n) => n.type === name && n.props.data === rows[position],
    );
    return (unique ? UniqueDetails : IndexDetails)(row.props);
  }
  return {
    get table() {
      return table;
    },
    get undoStack() {
      return undoStack;
    },
    add(unique = false) {
      const tree = Footer({ data: table });
      const label = unique ? "add_unique_constraint" : "add_index";
      find(tree, (n) => n.props?.children?.includes(label)).props.onClick();
    },
    select(position, fields, unique = false) {
      find(editor(position, unique), (n) => n.type === "Select").props.onChange(
        fields,
      );
    },
    remove(position, unique = false) {
      find(
        editor(position, unique),
        (n) => n.type === "Button" && n.props.children.includes("delete"),
      ).props.onClick();
    },
    undo: () => history("undo"),
    redo: () => history("redo"),
  };
}

test("PostgreSQL: newly added index retains selected fields", async () => {
  const h = await harness();
  h.add();
  h.select(0, ["email"]);
  assert.deepEqual(h.table.indices[0].fields, ["email"]);
  assert.equal(h.undoStack.at(-1).iid, h.table.indices[0].id);
});

test("PostgreSQL: legacy numeric index IDs still support field selection", async () => {
  const h = await harness([{ id: 0, name: "legacy", fields: [] }]);
  h.select(0, ["email"]);
  assert.deepEqual(h.table.indices[0].fields, ["email"]);
});

test("PostgreSQL: mixed IDs target the correct index and retain multi-field order", async () => {
  const h = await harness([
    { id: 7, name: "legacy", fields: [] },
    { id: "copied-index", name: "copied", fields: [] },
  ]);
  h.select(1, ["tenant_id", "email"]);
  assert.deepEqual(h.table.indices[0].fields, []);
  assert.deepEqual(h.table.indices[1].fields, ["tenant_id", "email"]);
  h.select(1, ["email"]);
  assert.deepEqual(h.table.indices[1].fields, ["email"]);
  h.select(1, []);
  assert.deepEqual(h.table.indices[1].fields, []);
  h.undo();
  assert.deepEqual(h.table.indices[1].fields, ["email"]);
});

test("PostgreSQL: deleting a non-first legacy index restores its original position", async () => {
  const indices = [
    { id: 4, name: "first", fields: [] },
    { id: 9, name: "second", fields: ["email"] },
  ];
  const h = await harness(indices);
  h.remove(1);
  assert.deepEqual(h.table.indices, [indices[0]]);
  h.undo();
  assert.deepEqual(h.table.indices, indices);
  h.redo();
  assert.deepEqual(h.table.indices, [indices[0]]);
});

for (const unique of [false, true]) {
  const label = unique ? "unique constraint" : "index";
  const collection = unique ? "uniqueConstraints" : "indices";
  test(`${label}: add, select, undo twice and redo twice preserve identity and fields`, async () => {
    const h = await harness();
    h.add(unique);
    const original = structuredClone(h.table[collection][0]);
    h.select(0, ["email"], unique);
    h.undo();
    assert.deepEqual(h.table[collection][0].fields, []);
    h.undo();
    assert.deepEqual(h.table[collection], []);
    h.redo();
    assert.deepEqual(h.table[collection][0], original);
    h.redo();
    assert.deepEqual(h.table[collection][0].fields, ["email"]);
  });

  test(`${label}: delete and restore preserve IDs, order and earlier edit history`, async () => {
    const h = await harness();
    h.add(unique);
    h.add(unique);
    h.select(1, ["email"], unique);
    const original = structuredClone(h.table[collection]);
    h.remove(0, unique);
    assert.deepEqual(h.table[collection], [original[1]]);
    h.undo();
    assert.deepEqual(h.table[collection], original);
    h.redo();
    assert.deepEqual(h.table[collection], [original[1]]);
    h.undo();
    h.undo();
    assert.deepEqual(h.table[collection][1].fields, []);
    h.redo();
    assert.deepEqual(h.table[collection], original);
  });
}
