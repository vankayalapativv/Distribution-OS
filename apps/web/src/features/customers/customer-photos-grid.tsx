"use client";

import type { ActionConfig } from "@/lib/api-client";
import { AuthImage, DATE_FMT } from "@/features/market-intelligence/market-intelligence-media";

export interface CustomerPhoto {
  id: string;
  contentType: string;
  category: string;
  createdAt: string;
  uploaderName: string | null;
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4";

/** One loading placeholder tile (matches a photo tile's shape). */
export function TileSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="aspect-[4/3] w-full animate-pulse bg-slate-200" />
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="h-3.5 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-14 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function PhotosSkeletonGrid() {
  return (
    <div className={GRID}>
      {Array.from({ length: 4 }, (_, i) => (
        <TileSkeleton key={i} />
      ))}
    </div>
  );
}

/** Clickable photo tile with date + uploader caption. */
export function PhotoTile({
  photo,
  actionConfig,
  onOpen,
}: {
  readonly photo: CustomerPhoto;
  readonly actionConfig: ActionConfig;
  readonly onOpen: (p: CustomerPhoto) => void;
}) {
  const date = DATE_FMT.format(new Date(photo.createdAt));
  return (
    <button
      type="button"
      onClick={() => onOpen(photo)}
      className="group overflow-hidden rounded-xl border border-border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      title={`Uploaded ${date} by ${photo.uploaderName ?? "unknown"}`}
    >
      <AuthImage
        photoId={photo.id}
        config={actionConfig}
        className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]"
      />
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold">{date}</p>
        <p className="text-xs text-muted-foreground">by {photo.uploaderName ?? "—"}</p>
      </div>
    </button>
  );
}

export function PhotosGrid({
  photos,
  actionConfig,
  onOpen,
}: {
  readonly photos: CustomerPhoto[];
  readonly actionConfig: ActionConfig;
  readonly onOpen: (p: CustomerPhoto) => void;
}) {
  return (
    <div className={GRID}>
      {photos.map((photo) => (
        <PhotoTile key={photo.id} photo={photo} actionConfig={actionConfig} onOpen={onOpen} />
      ))}
    </div>
  );
}
