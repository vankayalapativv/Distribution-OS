import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth";
import { fetchSeCustomers, type DirectoryCustomer } from "../../lib/customer-directory";
import { getLocalDb } from "../../lib/db";
import { getReminderById } from "../../lib/reminders";

/** All state + derived data for the reminder form. Doubles as the Edit form
 *  when an `id` param is passed (pre-fills once from the local DB). */
export function useReminderForm() {
  const token = useAuth((s) => s.token);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;

  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<Date>(() => new Date(Date.now() + 60 * 60 * 1000));
  const [prefilled, setPrefilled] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [customer, setCustomer] = useState<DirectoryCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Online-only, SE-scoped: /customers returns ONLY this SE's own customers.
  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => fetchSeCustomers(token),
    enabled: Boolean(token),
  });
  const allCustomers = customersQuery.data ?? [];

  // Edit mode: load the existing reminder once and pre-fill the form.
  useEffect(() => {
    if (editId == null || prefilled) return;
    const db = getLocalDb();
    if (!db) return;
    const r = getReminderById(db, editId);
    if (r) {
      setTitle(r.title);
      setWhen(new Date(r.remindAt));
      if (r.customerId) {
        setCustomer({
          id: r.customerId,
          name: r.customerName ?? "",
          code: null,
          phone: null,
          address: null,
          city: null,
        });
      }
    }
    setPrefilled(true);
  }, [editId, prefilled]);

  const trimmedSearch = customerSearch.trim();
  const filteredCustomers = useMemo(() => {
    const q = trimmedSearch.toLowerCase();
    if (!q) return [];
    return allCustomers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code ?? "").toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [allCustomers, trimmedSearch]);

  const whenLabel = `${when.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;

  return {
    editId,
    title,
    setTitle,
    when,
    setWhen,
    showDate,
    setShowDate,
    showTime,
    setShowTime,
    customer,
    setCustomer,
    customerSearch,
    setCustomerSearch,
    error,
    setError,
    busy,
    setBusy,
    customersQuery,
    trimmedSearch,
    filteredCustomers,
    whenLabel,
  };
}
