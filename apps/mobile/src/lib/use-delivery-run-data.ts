// Data layer for the delivery screen: the active run and its stops (mirrored
// locally on each successful server write). Pull-to-refresh and focus both
// re-read from the local DB.

import { useCallback, useState } from "react";
import { getLocalDb } from "./db";
import {
  getActiveDeliveryRun,
  getDeliveryStops,
  type LocalDeliveryRun,
  type LocalDeliveryStop,
} from "./sync-core";
import { usePullRefresh } from "./use-pull-refresh";

export function useDeliveryRunData() {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<LocalDeliveryRun | null>(null);
  const [stops, setStops] = useState<LocalDeliveryStop[]>([]);

  const reload = useCallback(() => {
    const db = getLocalDb();
    if (!db) {
      setActive(null);
      setStops([]);
      setLoading(false);
      return;
    }
    const run = getActiveDeliveryRun(db);
    setActive(run);
    setStops(run ? getDeliveryStops(db, run.clientUuid) : []);
    setLoading(false);
  }, []);

  const { refreshing, onRefresh } = usePullRefresh(async () => {
    reload();
  });

  return { loading, active, stops, reload, refreshing, onRefresh };
}
