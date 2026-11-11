import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { DeliveryScreenView } from "../../components/delivery/delivery-screen-view";
import { useAuth } from "../../lib/auth";
import { usePlaceholderColor } from "../../lib/theme";
import { useDeliveryRunData } from "../../lib/use-delivery-run-data";
import { useDeliveryRunForm } from "../../lib/use-delivery-run-form";
import { useRunFields } from "../../lib/use-run-fields";
import { useRunPhotos } from "../../lib/use-run-photos";

export default function DeliveryScreen() {
  const user = useAuth((s) => s.user);
  const placeholder = usePlaceholderColor();
  const data = useDeliveryRunData();
  const photos = useRunPhotos();
  const fields = useRunFields();
  const submit = useDeliveryRunForm({
    active: data.active,
    stopsCount: data.stops.length,
    reload: data.reload,
    fields,
    odoPhoto: photos.odoPhoto,
    endPhoto: photos.endPhoto,
    resetPhotos: photos.resetPhotos,
  });

  useFocusEffect(useCallback(() => data.reload(), [data.reload]));

  async function onAddPhoto(which: "start" | "end") {
    const ok = await photos.addPhoto(which);
    if (!ok) return;
    submit.setError(null);
    if (which === "start") fields.clearStartPhotoErr();
    else fields.clearEndPhotoErr();
  }

  return (
    <DeliveryScreenView
      data={data}
      photos={photos}
      fields={fields}
      submit={submit}
      placeholder={placeholder}
      userName={user?.name ?? ""}
      onAddPhoto={onAddPhoto}
      onAddDelivery={() =>
        router.push({ pathname: "/(logistics)/add-delivery", params: { runClientUuid: data.active?.clientUuid ?? "" } })
      }
    />
  );
}
