import { useMemo, useRef, useState } from "react";
import {
  Action,
  Tab,
  ObjectType,
  tableHeaderHeight,
  tableColorStripHeight,
} from "../../data/constants";
import {
  IconChevronDown,
  IconChevronUp,
  IconMore,
  IconMinus,
  IconDeleteStroked,
  IconEditStroked,
  IconCopyStroked,
  IconKeyStroked,
  IconLock,
  IconUnlock,
} from "@douyinfe/semi-icons";
import { nanoid } from "nanoid";
import {
  Popover,
  Tag,
  Button,
  ButtonGroup,
  Divider,
  Input,
  Modal,
} from "@douyinfe/semi-ui";
import {
  useLayout,
  useSettings,
  useDiagram,
  useSelect,
  useUndoRedo,
} from "../../hooks";
import TableInfo from "../EditorSidePanel/TablesTab/TableInfo";
import TableInfoFooter from "../EditorSidePanel/TablesTab/TableInfoFooter";
import { useTranslation } from "react-i18next";
import { resolveType } from "../../utils/customTypes";
import { isRtl } from "../../i18n/utils/rtl";
import i18n from "../../i18n/i18n";
import {
  getCommentHeight,
  getFieldOffsetY,
  getTableHeight,
  getVisibleFieldEntries,
  getVisibleFields,
  getRelationshipFields,
  measureFieldRowWidth,
  measureTableHeaderWidth,
} from "../../utils/utils";

export default function Table({
  tableData,
  onPointerDown,
  setHoveredTable,
  handleGripField,
  setLinkingLine,
}) {
  const [hoveredField, setHoveredField] = useState(null);
  // Modal 内的可折叠面板状态：从 TableInfo 提升到这里，
  // 让底部 footer（TableInfoFooter）也能控制面板展开。
  const [indexPanelKey, setIndexPanelKey] = useState("");
  const [uqPanelKey, setUqPanelKey] = useState("");
  const [commentPanelKey, setCommentPanelKey] = useState("");
  const [showCommentCard, setShowCommentCard] = useState(false);
  // 表名 onFocus 时的快照，用于 onBlur 构造 undo 记录
  // 放在 Modal title 内（Semi UI 真正固定的 header 区），因此不使用 useState
  const nameFocusRef = useRef("");
  const { layout } = useLayout();
  const {
    database,
    tables,
    relationships,
    addTable,
    deleteTable,
    deleteField,
    updateTable,
  } = useDiagram();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { settings } = useSettings();
  const { t } = useTranslation();
  const {
    selectedElement,
    setSelectedElement,
    bulkSelectedElements,
    setBulkSelectedElements,
  } = useSelect();

  // 用 Canvas measureText 测每行实际像素宽度 + 显式累加 gap/padding/border，
  // 完全脱离 DOM 渲染，真实字段行布局见 measureFieldRowWidth 内注释。
  const visibleFields = useMemo(
    () => getVisibleFields(tableData, relationships),
    [tableData, relationships],
  );

  const measuredWidth = useMemo(() => {
    if (typeof document === "undefined") return settings.tableWidth;
    const headerW = measureTableHeaderWidth(tableData.name);
    let maxW = headerW;
    visibleFields.forEach((f) => {
      const w = measureFieldRowWidth({
        displayName: f.displayName,
        name: f.name,
        type: f.type,
        size: f.size,
      });
      if (w > maxW) maxW = w;
    });
    return Math.max(maxW, settings.tableWidth);
  }, [tableData.name, visibleFields, settings.tableWidth]);

  const borderColor = useMemo(
    () => (settings.mode === "light" ? "border-zinc-300" : "border-zinc-600"),
    [settings.mode],
  );

  // 表格宽 = 测量宽度（未测量完成时用 settings.tableWidth 兜底，保证初始有合理高度）
  const tableWidth = measuredWidth || settings.tableWidth;

  const height = getTableHeight(
    tableData,
    tableWidth,
    settings.showComments,
    relationships,
  );

  const visibleFieldEntries = useMemo(
    () => getVisibleFieldEntries(tableData, relationships),
    [tableData, relationships],
  );

  const isSelected = useMemo(() => {
    return (
      (selectedElement.id == tableData.id &&
        selectedElement.element === ObjectType.TABLE) ||
      bulkSelectedElements.some(
        (e) => e.type === ObjectType.TABLE && e.id === tableData.id,
      )
    );
  }, [selectedElement, tableData, bulkSelectedElements]);

  const toggleTableCollapse = (e) => {
    e.stopPropagation();
    if (layout.readOnly) return;

    const collapsed = !tableData.collapsed;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "self",
        tid: tableData.id,
        undo: { collapsed: tableData.collapsed },
        redo: { collapsed },
        message: t("edit_table", {
          tableName: tableData.name,
          extra: "[collapse fields]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(tableData.id, { collapsed });
  };

  const lockUnlockTable = (e) => {
    const locking = !tableData.locked;
    updateTable(tableData.id, { locked: locking });

    const lockTable = () => {
      setSelectedElement({
        ...selectedElement,
        element: ObjectType.NONE,
        id: -1,
        open: false,
      });
      setBulkSelectedElements((prev) =>
        prev.filter(
          (el) => el.id !== tableData.id || el.type !== ObjectType.TABLE,
        ),
      );
    };

    const unlockTable = () => {
      const elementInBulk = {
        id: tableData.id,
        type: ObjectType.TABLE,
        initialCoords: { x: tableData.x, y: tableData.y },
        currentCoords: { x: tableData.x, y: tableData.y },
      };
      if (e.ctrlKey || e.metaKey) {
        setBulkSelectedElements((prev) => [...prev, elementInBulk]);
      } else {
        setBulkSelectedElements([elementInBulk]);
      }
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.TABLE,
        id: tableData.id,
        open: false,
      }));
    };

    if (locking) {
      lockTable();
    } else {
      unlockTable();
    }
  };

  const duplicateTable = () => {
    if (layout.readOnly) return;
    const duplicated = {
      ...tableData,
      id: nanoid(),
      name: `${tableData.name}_copy`,
      x: tableData.x + 24,
      y: tableData.y + 24,
      fields: tableData.fields.map((f) => ({ ...f, id: nanoid() })),
      indices: tableData.indices.map((idx) => ({ ...idx, id: nanoid() })),
    };
    addTable({ table: duplicated });
  };

  const openEditor = () => {
    setSelectedElement((prev) => ({
      ...prev,
      currentTab: layout.sidebar ? Tab.TABLES : prev.currentTab,
      element: ObjectType.TABLE,
      id: tableData.id,
      open: true,
    }));
    if (!layout.sidebar) return;
    if (selectedElement.currentTab !== Tab.TABLES) return;
    document
      .getElementById(`scroll_table_${tableData.id}`)
      .scrollIntoView({ behavior: "smooth" });
  };

  const getFieldReference = (fieldData) => {
    let matchedEndFieldId = null;
    const rel = relationships.find((r) => {
      if (r.startTableId !== tableData.id) return false;
      const pair = getRelationshipFields(r).find(
        (p) => p.startFieldId === fieldData.id,
      );
      if (!pair) return false;
      matchedEndFieldId = pair.endFieldId;
      return true;
    });
    if (!rel) return null;

    const refTable = tables.find((tbl) => tbl.id === rel.endTableId);
    const refField = refTable?.fields.find((f) => f.id === matchedEndFieldId);
    if (!refTable || !refField) return null;

    return { tableName: refTable.name, fieldName: refField.name };
  };

  if (tableData.hidden) return null;

  return (
    <>
      <foreignObject
        key={tableData.id}
        x={tableData.x}
        y={tableData.y}
        width={tableWidth}
        height={height}
        className="group drop-shadow-lg rounded-md cursor-move"
        onPointerDown={onPointerDown}
      >
        <div
          onDoubleClick={openEditor}
          style={{
            direction: "ltr",
            width: tableWidth,
          }}
          className={`border-2 hover:border-dashed hover:border-blue-500
               select-none rounded-lg ${
                 settings.mode === "light"
                   ? "bg-zinc-100 text-zinc-800"
                   : "bg-zinc-800 text-zinc-200"
               } ${isSelected ? "border-solid border-blue-500" : borderColor}`}
        >
          <div
            className="h-[10px] w-full rounded-t-md"
            style={{ backgroundColor: tableData.color }}
          />
          <div
            className={`${
              visibleFieldEntries.length === 0
                ? "rounded-b-md"
                : "border-b border-gray-400"
            } ${
              settings.mode === "light" ? "bg-zinc-100" : "bg-zinc-900"
            } ${tableData.comment && settings.showComments ? "pb-3" : ""}`}
          >
            <div
              className={`font-bold h-[40px] flex justify-between items-center gap-2`}
            >
              <div className="px-3 whitespace-nowrap flex-1">
                {tableData.name}
              </div>
              <div className="hidden group-hover:flex items-center shrink-0 pe-2">
                <ButtonGroup
                  type="tertiary"
                  size="small"
                  aria-label="Table actions"
                >
                  <Button
                    size="small"
                    type="tertiary"
                    title={tableData.locked ? "Unlock table" : "Lock table"}
                    icon={
                      tableData.locked ? (
                        <IconLock size="small" />
                      ) : (
                        <IconUnlock size="small" />
                      )
                    }
                    disabled={layout.readOnly}
                    onClick={lockUnlockTable}
                  />
                  <Button
                    size="small"
                    type="tertiary"
                    icon={
                      tableData.collapsed ? (
                        <IconChevronDown size="small" />
                      ) : (
                        <IconChevronUp size="small" />
                      )
                    }
                    disabled={layout.readOnly}
                    aria-label={
                      tableData.collapsed
                        ? "Expand unlinked fields"
                        : "Collapse unlinked fields"
                    }
                    title={
                      tableData.collapsed
                        ? "Expand unlinked fields"
                        : "Collapse unlinked fields"
                    }
                    onClick={toggleTableCollapse}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  <Popover
                    key={tableData.id}
                    content={
                      <div className="popover-theme flex flex-col py-1 min-w-[160px]">
                        <Button
                          icon={<IconEditStroked />}
                          type="tertiary"
                          theme="borderless"
                          block
                          style={{ justifyContent: "flex-start" }}
                          onClick={openEditor}
                        >
                          {t("edit")}
                        </Button>
                        <Button
                          icon={<IconCopyStroked />}
                          type="tertiary"
                          theme="borderless"
                          block
                          style={{ justifyContent: "flex-start" }}
                          onClick={duplicateTable}
                          disabled={layout.readOnly}
                        >
                          {t("duplicate")}
                        </Button>
                        <Divider className="!my-1" />
                        <Button
                          icon={<IconDeleteStroked />}
                          type="danger"
                          theme="borderless"
                          block
                          style={{ justifyContent: "flex-start" }}
                          onClick={() => {
                            if (layout.readOnly) return;
                            Modal.confirm({
                              title: t("delete_table", {
                                tableName: tableData.name || "table",
                              }),
                              content: t("are_you_sure_delete_table"),
                              okText: t("delete"),
                              okButtonProps: { type: "danger" },
                              cancelText: t("cancel"),
                              onOk: () => deleteTable(tableData.id),
                            });
                          }}
                          disabled={layout.readOnly}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    }
                    position="rightTop"
                    style={{ padding: 8 }}
                    showArrow
                    trigger="click"
                  >
                    <Button
                      size="small"
                      type="tertiary"
                      icon={<IconMore size="small" />}
                      title="See more"
                    />
                  </Popover>
                </ButtonGroup>
              </div>
            </div>
            {tableData.comment && settings.showComments && (
              <div className="text-xs px-3 line-clamp-5">
                {tableData.comment}
              </div>
            )}
          </div>

          {visibleFieldEntries.map(({ field: e }, i) => {
            const resolved = resolveType(database, e.type);
            const reference = getFieldReference(e);
            return settings.showFieldSummary ? (
              <Popover
                key={e.id ?? i}
                content={
                  <div className="popover-theme">
                    <div
                      className="flex justify-between items-center pb-2"
                      style={{ direction: "ltr" }}
                    >
                      <p className="me-4 font-bold">{e.name}</p>
                      <p
                        className={
                          "ms-4 font-mono " +
                          (resolved.isCustom ? "" : resolved.color)
                        }
                        style={
                          resolved.isCustom ? { color: resolved.color } : {}
                        }
                      >
                        {e.type +
                          ((resolved.isSized || resolved.hasPrecision) &&
                          e.size &&
                          e.size !== ""
                            ? "(" + e.size + ")"
                            : "")}
                      </p>
                    </div>
                    <hr />
                    {e.primary && (
                      <Tag color="blue" className="me-2 my-2">
                        {t("primary_key")}
                      </Tag>
                    )}
                    {e.unique && (
                      <Tag color="amber" className="me-2 my-2">
                        {t("unique")}
                      </Tag>
                    )}
                    {e.notNull && (
                      <Tag color="purple" className="me-2 my-2">
                        {t("not_null")}
                      </Tag>
                    )}
                    {e.increment && (
                      <Tag color="green" className="me-2 my-2">
                        {t("autoincrement")}
                      </Tag>
                    )}
                    {reference && (
                      <Tag color="light-blue" className="me-2 my-2">
                        {t("foreign_key")}
                      </Tag>
                    )}
                    {e.displayName && (
                      <p>
                        <strong>{t("display_name")}: </strong>
                        {e.displayName}
                      </p>
                    )}
                    {reference && (
                      <p>
                        <strong>{t("references")}: </strong>
                        {reference.tableName}({reference.fieldName})
                      </p>
                    )}
                    <p>
                      <strong>{t("default_value")}: </strong>
                      {e.default === "" ? t("not_set") : e.default}
                    </p>
                    <p className="max-w-80">
                      <strong>{t("comment")}: </strong>
                      {e.comment === "" ? t("not_set") : e.comment}
                    </p>
                  </div>
                }
                position="right"
                showArrow
                style={
                  isRtl(i18n.language)
                    ? { direction: "rtl" }
                    : { direction: "ltr" }
                }
              >
                {field(e, i)}
              </Popover>
            ) : (
              field(e, i)
            );
          })}
        </div>
      </foreignObject>
      <Modal
        title={
          <div className="flex items-center gap-2 pr-8">
            <span className="font-semibold shrink-0">
              {t("name")}:
            </span>
            <Input
              value={tableData.name}
              validateStatus={
                tableData.name.trim() === "" ? "error" : "default"
              }
              placeholder={t("name")}
              className="flex-1"
              readonly={layout.readOnly}
              onChange={(value) =>
                updateTable(tableData.id, { name: value })
              }
              onFocus={(e) => {
                nameFocusRef.current = e.target.value;
              }}
              onBlur={(e) => {
                if (e.target.value === nameFocusRef.current) return;
                setUndoStack((prev) => [
                  ...prev,
                  {
                    action: Action.EDIT,
                    element: ObjectType.TABLE,
                    component: "self",
                    tid: tableData.id,
                    undo: { name: nameFocusRef.current },
                    redo: { name: e.target.value },
                    message: t("edit_table", {
                      tableName: e.target.value,
                      extra: "[name]",
                    }),
                  },
                ]);
                setRedoStack([]);
              }}
            />
          </div>
        }
        size="large"
        centered
        visible={
          selectedElement.element === ObjectType.TABLE &&
          selectedElement.id === tableData.id &&
          selectedElement.open
        }
        onCancel={() =>
          setSelectedElement((prev) => ({
            ...prev,
            open: !prev.open,
          }))
        }
        footer={
          <TableInfoFooter
            data={tableData}
            onAddIndex={() => setIndexPanelKey("1")}
            onAddUniqueConstraint={() => setUqPanelKey("1")}
            onAddComment={() => {
              setShowCommentCard(true);
              setCommentPanelKey("1");
            }}
          />
        }
        className="table-editor-modal"
        bodyStyle={{
          maxHeight: "calc(100vh - 320px)",
          padding: 0,
          overflowY: "auto",
        }}
        style={{
          width: "880px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 200px)",
        }}
        maskClosable
      >
        <div className="px-4 pt-2 pb-4">
          <TableInfo
            data={tableData}
            indexPanelKey={indexPanelKey}
            setIndexPanelKey={setIndexPanelKey}
            uqPanelKey={uqPanelKey}
            setUqPanelKey={setUqPanelKey}
            commentPanelKey={commentPanelKey}
            setCommentPanelKey={setCommentPanelKey}
            showComment={showCommentCard}
          />
        </div>
      </Modal>
    </>
  );

  function field(fieldData, index) {
    const fieldResolved = resolveType(database, fieldData.type);
    const showFieldComment = fieldData.comment && settings.showComments;
    return (
      <div
        className={`${
          index === visibleFields.length - 1 ? "" : "border-b border-gray-400"
        } group w-full`}
        onPointerEnter={(e) => {
          if (!e.isPrimary) return;

          setHoveredField(index);
          setHoveredTable({
            tableId: tableData.id,
            fieldId: fieldData.id,
          });
        }}
        onPointerLeave={(e) => {
          if (!e.isPrimary) return;

          setHoveredField(null);
          setHoveredTable({
            tableId: null,
            fieldId: null,
          });
        }}
        onPointerDown={(e) => {
          // Required for onPointerLeave to trigger when a touch pointer leaves
          // https://stackoverflow.com/a/70976017/1137077
          e.target.releasePointerCapture(e.pointerId);
        }}
      >
        <div className="h-[36px] px-2 py-1 flex justify-between items-center gap-1">
          <div
            className={`${
              hoveredField === index ? "text-zinc-400" : ""
            } flex items-center gap-2`}
          >
            <button
              className="shrink-0 w-[10px] h-[10px] bg-[#2f68adcc] rounded-full"
              onPointerDown={(e) => {
                if (!e.isPrimary) return;

                handleGripField();
                const fieldY =
                  tableData.y +
                  getFieldOffsetY(
                    visibleFields,
                    index,
                    tableWidth,
                    settings.showComments,
                  ) +
                  tableHeaderHeight +
                  tableColorStripHeight +
                  getCommentHeight(
                    tableData.comment,
                    tableWidth,
                    settings.showComments,
                  ) +
                  14;
                setLinkingLine((prev) => ({
                  ...prev,
                  startFieldId: fieldData.id,
                  startTableId: tableData.id,
                  startX: tableData.x + 15,
                  startY: fieldY,
                  endX: tableData.x + 15,
                  endY: fieldY,
                }));
              }}
            />
            <span className="flex items-center gap-1">
              {fieldData.displayName && (
                <>
                  <span className="text-zinc-500 italic text-xs shrink-0 whitespace-nowrap">
                    {fieldData.displayName}
                  </span>
                  <span className="text-zinc-400 shrink-0">·</span>
                </>
              )}
              <span className="whitespace-nowrap">
                {fieldData.name}
              </span>
            </span>
          </div>
          <div className="text-zinc-400 shrink-0">
            {hoveredField === index ? (
              <Button
                theme="solid"
                size="small"
                style={{
                  backgroundColor: "#d42020b3",
                }}
                icon={<IconMinus />}
                disabled={layout.readOnly}
                onClick={() => {
                  if (layout.readOnly) return;
                  deleteField(fieldData, tableData.id);
                }}
              />
            ) : settings.showDataTypes ? (
              <div className="flex gap-1 items-center">
                {fieldData.primary && <IconKeyStroked />}
                {!fieldData.notNull && <span className="font-mono">?</span>}
                <span
                  className={
                    "font-mono " +
                    (fieldResolved.isCustom ? "" : fieldResolved.color)
                  }
                  style={
                    fieldResolved.isCustom ? { color: fieldResolved.color } : {}
                  }
                >
                  {fieldData.type +
                    ((fieldResolved.isSized || fieldResolved.hasPrecision) &&
                    fieldData.size &&
                    fieldData.size !== ""
                      ? `(${fieldData.size})`
                      : "")}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        {showFieldComment && (
          <div className="ms-3 px-3 pb-3">
            <div
              className={`text-xs line-clamp-2 ${settings.mode === "light" ? "text-zinc-600" : "text-zinc-200"}`}
            >
              {fieldData.comment}
            </div>
          </div>
        )}
      </div>
    );
  }
}
