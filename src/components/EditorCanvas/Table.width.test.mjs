import React from "react";
import { createRoot } from "react-dom/client";
import Table from "./Table.jsx";
import { DB } from "../../data/constants.js";
import { DiagramContext } from "../../context/DiagramContext.jsx";
import { LayoutContext } from "../../context/LayoutContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import { SelectContext } from "../../context/SelectContext.jsx";
import { UndoRedoContext } from "../../context/UndoRedoContext.jsx";

const noop = () => {};
const h = React.createElement;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// 在 Vite 浏览器环境执行，测量真实组件与样式，不访问或修改用户图表。
export async function runTableWidthRegression() {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:white;overflow:auto";
  document.body.append(host);
  const root = createRoot(host);
  const reports = [];
  const field = {
    id: "field",
    name: "long_primary_key_column_name_for_measurement",
    displayName: "业务标识",
    type: "VARCHAR",
    size: "255",
    primary: true,
    notNull: false,
  };
  const base = {
    id: "width-regression",
    x: 10,
    y: 10,
    name: "accounts",
    color: "#175e7a",
    fields: [field],
    indices: [],
  };

  async function render(table, options = {}) {
    host.style.fontSize = `${options.fontSize || 16}px`;
    let tree = h(
      "svg",
      { width: 2200, height: 900 },
      h(
        "g",
        { transform: `scale(${options.zoom || 1})` },
        h(Table, { tableData: table, setHoveredTable: noop }),
      ),
    );
    const providers = [
      [
        DiagramContext,
        {
          tables: [table],
          relationships: [],
          database: DB.POSTGRES,
          updateTable: noop,
        },
      ],
      [LayoutContext, { layout: { readOnly: false, sidebar: false } }],
      [
        SettingsContext,
        {
          settings: {
            mode: "light",
            tableWidth: 220,
            showComments: true,
            showDataTypes: options.showDataTypes !== false,
            showFieldSummary: false,
          },
        },
      ],
      [
        SelectContext,
        {
          selectedElement: {},
          bulkSelectedElements: [],
          setSelectedElement: noop,
          setBulkSelectedElements: noop,
        },
      ],
      [UndoRedoContext, { setUndoStack: noop, setRedoStack: noop }],
    ];
    for (const [context, value] of providers) {
      tree = h(context.Provider, { value }, tree);
    }
    root.render(tree);
    await frame();
    await frame();
    return host.querySelector("foreignObject");
  }

  function inspect(label) {
    const foreign = host.querySelector("foreignObject");
    const header = host.querySelector(".h-\\[40px\\]");
    const actions = header.lastElementChild;
    // 模拟 CSS 悬停显示，检查按钮出现后依然能完整容纳。
    actions.style.display = "flex";
    actions.style.visibility = "visible";
    const rows = [header, ...host.querySelectorAll(".h-\\[36px\\]")];
    const overflow = rows.map((row) => row.scrollWidth - row.clientWidth);
    const width = Number(foreign.getAttribute("width"));
    const innerWidth = foreign.firstElementChild.offsetWidth;
    const pass =
      overflow.every((value) => value <= 1) &&
      Math.abs(width - innerWidth) <= 1;
    reports.push({ label, pass, width, innerWidth, overflow });
    return width;
  }

  try {
    await document.fonts.ready;
    await render(base);
    const normal = inspect("主键、可空标记、中文显示名及带长度类型");
    const fieldRow = host.querySelector(".h-\\[36px\\]");
    fieldRow.dispatchEvent(
      new PointerEvent("pointerover", {
        bubbles: true,
        isPrimary: true,
        pointerType: "mouse",
      }),
    );
    await frame();
    await frame();
    const hovered = inspect("字段悬停删除按钮");
    const deleteButton = fieldRow.querySelector(".grid > button");
    reports.push({
      label: "删除按钮显示且悬停不改变表宽",
      pass:
        hovered === normal &&
        getComputedStyle(deleteButton).visibility === "visible",
    });
    fieldRow.dispatchEvent(
      new PointerEvent("pointerout", {
        bubbles: true,
        isPrimary: true,
        pointerType: "mouse",
        relatedTarget: host,
      }),
    );
    await render({ ...base, fields: [], name: "long_table_name_".repeat(5) });
    inspect("长表名与表头悬停操作");
    await render({
      ...base,
      fields: [{ ...field, type: "TIMESTAMP WITH TIME ZONE", size: "" }],
    });
    inspect("含空格的长类型不换行");
    await render(base, { fontSize: 20 });
    inspect("继承不同字号");
    for (const zoom of [0.5, 2]) {
      await render(base, { zoom });
      const width = inspect(`画布缩放 ${zoom}`);
      reports.push({
        label: `缩放 ${zoom} 不改变逻辑宽度`,
        pass: width === normal,
      });
    }
    await render(base, { showDataTypes: false });
    inspect("隐藏数据类型");
    await render({
      ...base,
      name: "a",
      fields: [
        {
          ...field,
          name: "id",
          displayName: "",
          type: "INT",
          primary: false,
          notNull: true,
        },
      ],
    });
    const short = inspect("内容变短后收缩，悬停删除按钮仍能容纳");
    reports.push({
      label: "表格可以收缩",
      pass: short < normal && short >= 220,
    });
    await render({
      ...base,
      comment: "long_comment_".repeat(100),
      fields: [{ ...field, comment: "long_field_comment_".repeat(100) }],
    });
    const commentWidth = inspect("注释在内容宽度内换行");
    reports.push({ label: "注释不撑大表格", pass: commentWidth === normal });
    await render({ ...base, collapsed: true });
    const collapsed = inspect("折叠字段后的表头");
    reports.push({ label: "折叠后重新适应宽度", pass: collapsed < normal });
    await render({ ...base, hidden: true });
    await render(base);
    inspect("隐藏后重新显示");
    return { passed: reports.every((report) => report.pass), reports };
  } finally {
    root.unmount();
    host.remove();
  }
}
