import { useEffect, useState, useCallback } from "react";
import { diagramsApi } from "../../../../../api/diagrams";
import { useExtensions } from "../../../../../context/ExtensionsContext";
import { subscribe, TOPICS } from "../../../../../api/storeBus";

const DISABLED = { loading: false, error: null, items: [] };

function readError(err) {
  return err?.response?.data?.error || err?.message || "Failed to load";
}

export function useDiagramList() {
  const extensions = useExtensions();
  const cloudList = extensions?.cloudList;
  const cloudEnabled = typeof cloudList === "function";
  const currentUserId = extensions?.cloudCurrentUserId ?? null;

  const [local, setLocal] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);

  const reloadLocal = useCallback(async () => {
    try {
      const items = await diagramsApi.list();
      setLocal(items || []);
    } catch (err) {
      console.warn("load local diagrams failed", err);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadLocal();
    const unsubscribe = subscribe((topic) => {
      if (topic === TOPICS.DIAGRAMS_CHANGED) reloadLocal();
    });
    return unsubscribe;
  }, [reloadLocal]);

  const [cloud, setCloud] = useState(() =>
    cloudEnabled ? { loading: true, error: null, items: null } : DISABLED,
  );

  useEffect(() => {
    if (!cloudEnabled) {
      setCloud(DISABLED);
      return undefined;
    }
    let cancelled = false;
    setCloud({ loading: true, error: null, items: null });
    cloudList()
      .then((items) => {
        if (!cancelled) setCloud({ loading: false, error: null, items });
      })
      .catch((err) => {
        if (!cancelled)
          setCloud({ loading: false, error: readError(err), items: null });
      });
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, cloudList]);

  return {
    loading: cloud.loading || localLoading,
    error: cloud.error,
    cloud: cloud.items ?? [],
    local,
    cloudEnabled,
    currentUserId,
  };
}
