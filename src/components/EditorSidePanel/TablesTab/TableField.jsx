import { useMemo, useState } from "react";
import { Action, ObjectType } from "../../../data/constants";
import {
  Input,
  Button,
  Select,
  Modal,
  TagInput,
  Checkbox,
} from "@douyinfe/semi-ui";
import {
  IconDeleteStroked,
  IconKeyStroked,
} from "@douyinfe/semi-icons";
import {
  useEnums,
  useDiagram,
  useTypes,
  useUndoRedo,
  useLayout,
} from "../../../hooks";
import { useTranslation } from "react-i18next";
import { dbToTypes } from "../../../data/datatypes";
import { DragHandle } from "../../SortableList/DragHandle";
import { getCustomTypesForDb, resolveType } from "../../../utils/customTypes";
import { databases } from "../../../data/databases";

export default function TableField({ data, tid, index, inherited }) {
  const { updateField, deleteField } = useDiagram();
  const { types } = useTypes();
  const { enums } = useEnums();
  const { layout } = useLayout();
  const { tables, database } = useDiagram();
  const { t } = useTranslation();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const [editField, setEditField] = useState({});
  const table = useMemo(() => tables.find((t) => t.id === tid), [tables, tid]);
  const resolved = resolveType(database, data.type);

  const pushUndo = (key, newValue, messageExtra) => {
    if (newValue === editField[key]) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "field",
        tid,
        fid: data.id,
        undo: { [key]: editField[key] },
        redo: { [key]: newValue },
        message: t("edit_table", {
          tableName: table.name,
          extra: messageExtra || "[field]",
        }),
      },
    ]);
    setRedoStack([]);
  };

  const handleDelete = (e) => {
    e?.stopPropagation?.();
    if (layout.readOnly) return;
    Modal.confirm({
      title: t("delete"),
      content: `${t("delete")} "${data.name || "field"}" ?`,
      okText: t("delete"),
      okButtonProps: { type: "danger" },
      cancelText: t("cancel"),
      onOk: () => deleteField(data, tid),
    });
  };

  return (
    <div className="my-2 border border-transparent hover:border-zinc-200 rounded p-1.5">
      {/* 主行：displayName / name / type / size / precision / default / check / comment / NN / PK / 删除 — 全部一行 */}
      <div className="flex flex-wrap gap-2 items-center">
        <DragHandle readOnly={layout.readOnly} id={data.id} />

        {/* Display name (中文名/显示名) */}
        <div className="min-w-[100px] flex-1 basis-32">
          <Input
            size="small"
            value={data.displayName || ""}
            readonly={layout.readOnly}
            placeholder={t("display_name")}
            onChange={(value) =>
              updateField(tid, data.id, { displayName: value })
            }
            onFocus={(e) => setEditField({ displayName: e.target.value })}
            onBlur={(e) => pushUndo("displayName", e.target.value)}
          />
        </div>

        {/* Name */}
        <div className="min-w-[100px] flex-1 basis-32">
          <Input
            size="small"
            value={data.name}
            id={`scroll_table_${tid}_input_${index}`}
            validateStatus={
              data.name.trim() === "" || inherited ? "error" : "default"
            }
            readonly={layout.readOnly}
            placeholder={t("name")}
            onChange={(value) => updateField(tid, data.id, { name: value })}
            onFocus={(e) => setEditField({ name: e.target.value })}
            onBlur={(e) => pushUndo("name", e.target.value)}
          />
        </div>

        {/* Type */}
        <div className="min-w-[100px] flex-1 basis-32">
          <Select
            size="small"
            className="w-full"
            optionList={[
              ...Object.keys(dbToTypes[database]).map((value) => ({
                label: value,
                value,
              })),
              ...Object.keys(getCustomTypesForDb(database)).map((value) => ({
                label: value,
                value,
              })),
              ...types.map((type) => ({
                label: type.name.toUpperCase(),
                value: type.name.toUpperCase(),
              })),
              ...enums.map((type) => ({
                label: type.name.toUpperCase(),
                value: type.name.toUpperCase(),
              })),
            ]}
            filter
            value={data.type}
            validateStatus={data.type === "" ? "error" : "default"}
            placeholder={t("type")}
            onChange={(value) => {
              if (layout.readOnly) return;
              if (value === data.type) return;
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "field",
                  tid,
                  fid: data.id,
                  undo: { type: data.type },
                  redo: { type: value },
                  message: t("edit_table", {
                    tableName: table.name,
                    extra: "[field]",
                  }),
                },
              ]);
              setRedoStack([]);
              const typeInfo = resolveType(database, value);
              const incr = data.increment && !!typeInfo.canIncrement;

              if (value === "ENUM" || value === "SET") {
                updateField(tid, data.id, {
                  type: value,
                  default: "",
                  values: data.values ? [...data.values] : [],
                  increment: incr,
                });
              } else if (typeInfo.isSized || typeInfo.hasPrecision) {
                updateField(tid, data.id, {
                  type: value,
                  size: typeInfo.defaultSize,
                  increment: incr,
                });
              } else if (!typeInfo.hasDefault || incr) {
                updateField(tid, data.id, {
                  type: value,
                  increment: incr,
                  default: "",
                  size: "",
                  values: [],
                });
              } else if (typeInfo.hasCheck) {
                updateField(tid, data.id, {
                  type: value,
                  check: "",
                  increment: incr,
                });
              } else {
                updateField(tid, data.id, {
                  type: value,
                  increment: incr,
                  size: "",
                  values: [],
                });
              }
            }}
          />
        </div>

        {/* Size */}
        {resolved.isSized && (
          <div className="min-w-[70px] flex-1 basis-20">
            <Input
              size="small"
              type="number"
              min={1}
              step={1}
              placeholder={t("size")}
              value={data.size ?? ""}
              readonly={layout.readOnly}
              onChange={(value) => updateField(tid, data.id, { size: value })}
              onFocus={(e) => setEditField({ size: e.target.value })}
              onBlur={(e) => pushUndo("size", e.target.value)}
            />
          </div>
        )}

        {/* Precision */}
        {resolved.hasPrecision && (
          <div className="min-w-[70px] flex-1 basis-20">
            <Input
              size="small"
              placeholder={t("set_precision")}
              validateStatus={
                !data.size || /^\d+,\s*\d+$|^$/.test(data.size)
                  ? "default"
                  : "error"
              }
              readonly={layout.readOnly}
              value={data.size}
              onChange={(value) => updateField(tid, data.id, { size: value })}
              onFocus={(e) => setEditField({ size: e.target.value })}
              onBlur={(e) => pushUndo("size", e.target.value)}
            />
          </div>
        )}

        {/* Default */}
        <div className="min-w-[100px] flex-1 basis-32">
          <Input
            size="small"
            placeholder={t("default_value")}
            value={data.default}
            readonly={layout.readOnly}
            disabled={resolved.noDefault || data.increment}
            onChange={(value) =>
              updateField(tid, data.id, { default: value })
            }
            onFocus={(e) => setEditField({ default: e.target.value })}
            onBlur={(e) => pushUndo("default", e.target.value)}
          />
        </div>

        {/* Check */}
        {resolved.hasCheck && (
          <div className="min-w-[120px] flex-1 basis-40">
            <Input
              size="small"
              placeholder={t("check")}
              value={data.check}
              disabled={data.increment}
              readonly={layout.readOnly}
              onChange={(value) => updateField(tid, data.id, { check: value })}
              onFocus={(e) => setEditField({ check: e.target.value })}
              onBlur={(e) => pushUndo("check", e.target.value)}
            />
          </div>
        )}

        {/* Comment */}
        <div className="min-w-[140px] flex-1 basis-48">
          <Input
            size="small"
            placeholder={t("comment")}
            value={data.comment}
            readonly={layout.readOnly}
            onChange={(value) =>
              updateField(tid, data.id, { comment: value })
            }
            onFocus={(e) => setEditField({ comment: e.target.value })}
            onBlur={(e) => pushUndo("comment", e.target.value)}
          />
        </div>

        {/* NN / PK / delete */}
        <Button
          size="small"
          title={t("nullable")}
          type={data.notNull ? "tertiary" : "primary"}
          theme={data.notNull ? "light" : "solid"}
          onClick={() => {
            if (layout.readOnly) return;
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid,
                fid: data.id,
                undo: { notNull: data.notNull },
                redo: { notNull: !data.notNull },
                message: t("edit_table", {
                  tableName: table.name,
                  extra: "[field]",
                }),
              },
            ]);
            setRedoStack([]);
            updateField(tid, data.id, { notNull: !data.notNull });
          }}
        >
          ?
        </Button>

        <Button
          size="small"
          title={t("primary")}
          theme={data.primary ? "solid" : "light"}
          type={data.primary ? "primary" : "tertiary"}
          icon={<IconKeyStroked />}
          onClick={() => {
            if (layout.readOnly) return;
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid,
                fid: data.id,
                undo: { primary: data.primary },
                redo: { primary: !data.primary },
                message: t("edit_table", {
                  tableName: table.name,
                  extra: "[field]",
                }),
              },
            ]);
            setRedoStack([]);
            updateField(tid, data.id, { primary: !data.primary });
          }}
        />

        {/* Unique */}
        <Button
          size="small"
          title={t("unique")}
          theme={data.unique ? "solid" : "light"}
          type={data.unique ? "warning" : "tertiary"}
          onClick={() => {
            if (layout.readOnly) return;
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid,
                fid: data.id,
                undo: { unique: data.unique },
                redo: { unique: !data.unique },
                message: t("edit_table", {
                  tableName: table.name,
                  extra: "[field]",
                }),
              },
            ]);
            setRedoStack([]);
            updateField(tid, data.id, { unique: !data.unique });
          }}
        >
          U
        </Button>

        {/* Autoincrement */}
        <Button
          size="small"
          title={t("autoincrement")}
          theme={data.increment ? "solid" : "light"}
          type={data.increment ? "primary" : "tertiary"}
          disabled={!resolved.canIncrement || data.isArray || layout.readOnly}
          onClick={() => {
            if (layout.readOnly) return;
            setUndoStack((prev) => [
              ...prev,
              {
                action: Action.EDIT,
                element: ObjectType.TABLE,
                component: "field",
                tid,
                fid: data.id,
                undo: { increment: data.increment },
                redo: { increment: !data.increment },
                message: t("edit_table", {
                  tableName: table.name,
                  extra: "[field]",
                }),
              },
            ]);
            setRedoStack([]);
            updateField(tid, data.id, {
              increment: !data.increment,
              check: data.increment ? data.check : "",
            });
          }}
        >
          A
        </Button>

        <Button
          size="small"
          title={t("delete")}
          type="tertiary"
          theme="borderless"
          icon={<IconDeleteStroked />}
          disabled={layout.readOnly}
          onClick={handleDelete}
        />
      </div>

      {/* 次要行：ENUM/SET values 跨整行 + isArray/unsigned checkbox */}
      <div className="ms-6 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {(data.type === "ENUM" || data.type === "SET") && (
          <div className="w-full">
            <TagInput
              size="small"
              separator={[",", ", ", " ,"]}
              value={data.values}
              validateStatus={
                !data.values || data.values.length === 0 ? "error" : "default"
              }
              addOnBlur
              placeholder={`${data.type} ${t("values")} (${t("use_for_batch_input")})`}
              onChange={(v) => {
                if (layout.readOnly) return;
                updateField(tid, data.id, { values: v });
              }}
              onFocus={() => setEditField({ values: data.values })}
              onBlur={() => pushUndo("values", data.values)}
            />
          </div>
        )}

        {databases[database].hasArrays && (
          <Checkbox
            checked={data.isArray}
            disabled={layout.readOnly}
            onChange={(e) =>
              updateField(tid, data.id, {
                isArray: e.target.checked,
                increment: data.isArray ? data.increment : false,
              })
            }
          >
            {t("declare_array")}
          </Checkbox>
        )}
        {databases[database].hasUnsignedTypes && resolved.signed && (
          <Checkbox
            checked={data.unsigned}
            disabled={layout.readOnly}
            onChange={(e) =>
              updateField(tid, data.id, { unsigned: e.target.checked })
            }
          >
            {t("Unsigned")}
          </Checkbox>
        )}
      </div>
    </div>
  );
}
