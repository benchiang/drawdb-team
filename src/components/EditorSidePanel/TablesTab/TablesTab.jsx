import { Button } from "@douyinfe/semi-ui";
import { IconEyeOpened, IconEyeClosed, IconPlus } from "@douyinfe/semi-icons";
import {
  useSelect,
  useDiagram,
  useSaveState,
  useLayout,
  useUndoRedo,
} from "../../../hooks";
import { Action, ObjectType, State } from "../../../data/constants";
import { useTranslation } from "react-i18next";
import { DragHandle } from "../../SortableList/DragHandle";
import { SortableList } from "../../SortableList/SortableList";
import SearchBar from "./SearchBar";
import Empty from "../Empty";

export default function TablesTab() {
  const { tables, addTable, setTables } = useDiagram();
  const { t } = useTranslation();
  const { layout } = useLayout();
  const { setSaveState } = useSaveState();

  return (
    <>
      <div className="flex gap-2">
        <SearchBar tables={tables} />
        <div>
          <Button
            block
            icon={<IconPlus />}
            onClick={() => addTable()}
            disabled={layout.readOnly}
          >
            {t("add_table")}
          </Button>
        </div>
      </div>
      {tables.length === 0 ? (
        <Empty title={t("no_tables")} text={t("no_tables_text")} />
      ) : (
        <SortableList
          keyPrefix="tables-tab"
          items={tables}
          onChange={(newTables) => setTables(newTables)}
          afterChange={() => setSaveState(State.SAVING)}
          renderItem={(item) => <TableListItem table={item} />}
        />
      )}
    </>
  );
}

function TableListItem({ table }) {
  const { layout } = useLayout();
  const { updateTable } = useDiagram();
  const { selectedElement, setSelectedElement } = useSelect();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { t } = useTranslation();

  const isSelected =
    selectedElement.element === ObjectType.TABLE &&
    selectedElement.id === table.id;

  // 打开与画布双击 / 表格右键 "Edit" 共用的 Modal：
  // 复用 selectContext 的 selectedElement，由 Table.jsx 内的 Modal 监听 visible 触发。
  const openEditor = () => {
    setSelectedElement((prev) => ({
      ...prev,
      element: ObjectType.TABLE,
      id: table.id,
      open: true,
    }));
  };

  const toggleTableVisibility = (e) => {
    e.stopPropagation();
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "self",
        tid: table.id,
        undo: { hidden: table.hidden },
        redo: { hidden: !table.hidden },
        message: t("edit_table", {
          tableName: table.name,
          extra: "[hidden]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(table.id, { hidden: !table.hidden });
  };

  return (
    <div
      id={`scroll_table_${table.id}`}
      onClick={openEditor}
      className={`group relative flex items-center gap-1 rounded px-2 py-1.5 cursor-pointer ${
        isSelected
          ? "bg-blue-50 hover:bg-blue-50"
          : "hover:bg-zinc-100"
      }`}
    >
      <div
        className="absolute top-0 bottom-0 left-0 w-1 rounded-l"
        style={{ backgroundColor: table.color }}
      />
      <div className="flex items-center gap-2 flex-1 min-w-0 pl-1">
        <DragHandle readOnly={layout.readOnly} id={table.id} />
        <div className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
          {table.name}
        </div>
      </div>
      <Button
        size="small"
        theme="borderless"
        type="tertiary"
        onClick={toggleTableVisibility}
        icon={table.hidden ? <IconEyeClosed /> : <IconEyeOpened />}
        className="shrink-0"
      />
    </div>
  );
}
