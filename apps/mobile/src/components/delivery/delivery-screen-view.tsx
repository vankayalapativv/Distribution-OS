import type { useDeliveryRunData } from "../../lib/use-delivery-run-data";
import type { useDeliveryRunForm } from "../../lib/use-delivery-run-form";
import type { RunFields } from "../../lib/use-run-fields";
import type { useRunPhotos } from "../../lib/use-run-photos";
import { ActiveRunView } from "./active-run-view";
import { AllDoneView, DeliveryLoading, IdleView } from "./delivery-states";
import { EndRunForm } from "./end-run-form";
import { StartRunForm } from "./start-run-form";

export interface DeliveryScreenViewProps {
  readonly data: ReturnType<typeof useDeliveryRunData>;
  readonly photos: ReturnType<typeof useRunPhotos>;
  readonly fields: RunFields;
  readonly submit: ReturnType<typeof useDeliveryRunForm>;
  readonly placeholder: string;
  readonly userName: string;
  readonly onAddPhoto: (which: "start" | "end") => void;
  readonly onAddDelivery: () => void;
}

/** Picks which delivery view to render for the current run/form state. */
export function DeliveryScreenView({
  data, photos, fields, submit, placeholder, userName, onAddPhoto, onAddDelivery,
}: DeliveryScreenViewProps) {
  const uiError = submit.error ?? photos.photoError;

  if (data.loading) return <DeliveryLoading />;

  if (submit.finished && !data.active) {
    return (
      <AllDoneView
        vehicle={submit.finished.vehicle} stops={submit.finished.stops} km={submit.finished.km}
        onDone={() => submit.setFinished(null)}
      />
    );
  }

  if (!data.active && fields.mode === "start") {
    return (
      <StartRunForm
        vehicle={fields.vehicle} odo={fields.odo} odoPhoto={photos.odoPhoto} errors={fields.startErr}
        busy={submit.busy} stamping={photos.stampingPhoto === "start"} placeholder={placeholder} error={uiError}
        onVehicle={fields.changeVehicle} onOdo={fields.changeOdo}
        onAddPhoto={() => onAddPhoto("start")} onClearPhoto={() => photos.setOdoPhoto(null)} onSubmit={submit.onStart}
      />
    );
  }

  if (data.active && fields.mode === "end") {
    return (
      <EndRunForm
        stopsDone={data.stops.length} endOdo={fields.endOdo} endPhoto={photos.endPhoto} errors={fields.endErr}
        busy={submit.busy} stamping={photos.stampingPhoto === "end"} placeholder={placeholder} error={uiError}
        onEndOdo={fields.changeEndOdo}
        onAddPhoto={() => onAddPhoto("end")} onClearPhoto={() => photos.setEndPhoto(null)}
        onBack={() => { fields.setEndErr({}); fields.setMode("idle"); }} onSubmit={submit.onEnd}
      />
    );
  }

  if (data.active) {
    return (
      <ActiveRunView
        vehicleNumber={data.active.vehicleNumber} stops={data.stops}
        refreshing={data.refreshing} onRefresh={data.onRefresh}
        onAdd={onAddDelivery} onEndPress={submit.onEndPress}
      />
    );
  }

  return (
    <IdleView
      userName={userName}
      onStart={() => { submit.setError(null); fields.setMode("start"); }}
    />
  );
}
