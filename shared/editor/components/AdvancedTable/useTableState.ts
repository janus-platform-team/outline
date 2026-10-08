import { useCallback, useEffect, useRef, useState } from "react";
import type { AdvancedTableData } from "../../lib/advancedTable";

const CommitInterval = 300;

/**
 * Keeps a local draft of the table so edits render immediately, while writing
 * changes back to the document at most once per commit interval.
 *
 * @param data the table data stored in the document.
 * @param onChange callback that writes data to the document.
 * @returns the current draft, an update function and a flush function.
 */
export function useTableState(
  data: AdvancedTableData,
  onChange: (data: AdvancedTableData) => void
) {
  const [draft, setDraft] = useState(data);
  const draftRef = useRef(data);
  const lastSyncedRef = useRef(data);
  const pendingRef = useRef<AdvancedTableData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) {
      return;
    }
    pendingRef.current = null;
    lastSyncedRef.current = pending;
    onChangeRef.current(pending);
  }, []);

  const update = useCallback(
    (
      updater: (current: AdvancedTableData) => AdvancedTableData,
      options: { immediate?: boolean } = {}
    ) => {
      const next = updater(draftRef.current);
      if (next === draftRef.current) {
        return;
      }
      draftRef.current = next;
      pendingRef.current = next;
      setDraft(next);

      if (options.immediate) {
        flush();
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(flush, CommitInterval);
      }
    },
    [flush]
  );

  useEffect(() => {
    if (data === lastSyncedRef.current) {
      return;
    }
    lastSyncedRef.current = data;

    // Local edits that have not been written yet take precedence, they will
    // overwrite the incoming change when flushed.
    if (pendingRef.current) {
      return;
    }
    draftRef.current = data;
    setDraft(data);
  }, [data]);

  useEffect(() => flush, [flush]);

  return { draft, update, flush };
}
