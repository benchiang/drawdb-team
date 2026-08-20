import { useMemo, useState } from "react";
import { Banner, Spin } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { useDiagramList } from "./hooks/useDiagramList";
import {
  ALL,
  SOURCE,
  databaseOptions,
  filterDiagrams,
  mergeDiagrams,
  nextSort,
  sortDiagrams,
} from "./diagram";
import DiagramFilters from "./components/DiagramFilters";
import DiagramTable from "./components/DiagramTable";

const DEFAULT_SORT = { key: "lastModified", dir: "desc" };

function InfoBanner({ type, children }) {
  return (
    <Banner
      fullMode={false}
      type={type}
      bordered
      icon={null}
      closeIcon={null}
      description={<div>{children}</div>}
    />
  );
}

export default function Open({ selectedDiagramId, setSelectedDiagramId }) {
  const { t } = useTranslation();
  const { loading, error, cloud, local, cloudEnabled, currentUserId } =
    useDiagramList();

  const [query, setQuery] = useState("");
  const [database, setDatabase] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [sort, setSort] = useState(DEFAULT_SORT);

  const clearFilters = () => {
    setQuery("");
    setDatabase(ALL);
    setSource(ALL);
  };

  const diagrams = useMemo(() => mergeDiagrams(cloud, local), [cloud, local]);
  const dbOptions = useMemo(() => databaseOptions(diagrams), [diagrams]);
  const visible = useMemo(
    () =>
      sortDiagrams(filterDiagrams(diagrams, { query, database, source }), sort),
    [diagrams, query, database, source, sort],
  );

  // 分区：本地图按 accessRole 分为「我的图 / 共享给我」；云端图暂归入「我的图」（无区分语义）
  const { owned, shared } = useMemo(() => {
    const o = [];
    const s = [];
    for (const e of visible) {
      if (e.source === SOURCE.cloud || e.accessRole !== "collab") {
        o.push(e);
      } else {
        s.push(e);
      }
    }
    return { owned: o, shared: s };
  }, [visible]);

  const showOwner =
    cloudEnabled &&
    visible.some(
      (entry) =>
        entry.owner && String(entry.owner.id) !== String(currentUserId),
    );

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spin />
      </div>
    );
  }

  if (error) return <InfoBanner type="danger">{error}</InfoBanner>;

  if (diagrams.length === 0) {
    return <InfoBanner type="info">{t("no_saved_diagrams")}</InfoBanner>;
  }

  const tableProps = {
    sort,
    onSort: (key) => setSort((current) => nextSort(current, key)),
    selectedDiagramId,
    onSelect: setSelectedDiagramId,
    showType: cloudEnabled,
    showOwner,
    currentUserId,
  };

  function Section({ title, count, children }) {
    if (count === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-1 mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span>{title}</span>
          <span className="text-zinc-400">({count})</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <DiagramFilters
        query={query}
        onQueryChange={setQuery}
        database={database}
        onDatabaseChange={setDatabase}
        databaseOptions={dbOptions}
        source={source}
        onSourceChange={setSource}
        showSourceFilter={cloudEnabled}
        onClear={clearFilters}
      />
      <div className="max-h-[360px] overflow-auto">
        {visible.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 px-1 py-6 text-center">
            No diagrams match your filters.
          </div>
        ) : (
          <>
            <Section title="我的图" count={owned.length}>
              <DiagramTable entries={owned} {...tableProps} />
            </Section>
            <Section title="共享给我" count={shared.length}>
              <DiagramTable entries={shared} {...tableProps} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
