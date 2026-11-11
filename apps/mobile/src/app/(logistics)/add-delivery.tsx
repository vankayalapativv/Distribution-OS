import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { DeliveryConfirm } from "../../components/delivery/delivery-confirm";
import { InvoicePicker } from "../../components/delivery/invoice-picker";
import { useAuth } from "../../lib/auth";
import type { DeliverableInvoice } from "../../lib/deliverable-invoice";
import { pickFromCamera, type PickedPhoto } from "../../lib/photos";
import { stampPhoto } from "../../lib/photo-stamp";
import { usePlaceholderColor } from "../../lib/theme";
import { useDeliverableInvoices } from "../../lib/use-deliverable-invoices";
import { useSaveDeliveryStop } from "../../lib/use-save-delivery-stop";

export default function AddDeliveryScreen() {
  const { runClientUuid } = useLocalSearchParams<{ runClientUuid: string }>();
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const placeholder = usePlaceholderColor();

  const list = useDeliverableInvoices(token, runClientUuid);
  const [picked, setPicked] = useState<DeliverableInvoice | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [stamping, setStamping] = useState(false);
  const save = useSaveDeliveryStop(runClientUuid, picked, photos);

  // Tab-mounted screen: reset to a clean list on each navigation (the camera
  // round-trip doesn't fire focus, so in-progress photos survive) and re-read
  // locally-delivered invoices so they drop off immediately.
  useFocusEffect(
    useCallback(() => {
      setPicked(null);
      setPhotos([]);
      save.setError(null);
      list.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runClientUuid]),
  );

  async function addPhoto() {
    const { photos: p, error } = await pickFromCamera();
    if (error) return save.setError(error);
    if (!p.length) return;
    setStamping(true);
    try {
      const stamped = await Promise.all(
        p.map((ph) => stampPhoto(ph, { userName: user?.name ?? "", customerName: picked?.customerName ?? null })),
      );
      setPhotos((cur) => [...cur, ...stamped]);
      save.setError(null);
    } catch (err) {
      save.setError(err instanceof Error ? err.message : "Couldn't process the photo. Try again.");
    } finally {
      setStamping(false);
    }
  }

  if (picked) {
    return (
      <DeliveryConfirm
        invoice={picked}
        photos={photos}
        stamping={stamping}
        busy={save.busy}
        error={save.error}
        onBack={() => { setPicked(null); setPhotos([]); }}
        onAddPhoto={() => void addPhoto()}
        onRemovePhoto={(i) => setPhotos((cur) => cur.filter((_, j) => j !== i))}
        onSave={async () => { if (await save.save()) router.back(); }}
      />
    );
  }

  return (
    <InvoicePicker
      isPending={list.invoicesQuery.isPending}
      isError={list.invoicesQuery.isError}
      error={list.invoicesQuery.error}
      onRetry={() => void list.invoicesQuery.refetch()}
      filtered={list.filtered}
      search={list.search}
      placeholder={placeholder}
      onSearch={list.setSearch}
      onPick={(inv) => { setPicked(inv); setPhotos([]); save.setError(null); }}
      onBack={() => router.back()}
    />
  );
}
