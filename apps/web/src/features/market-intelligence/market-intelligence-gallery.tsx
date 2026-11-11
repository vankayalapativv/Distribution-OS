"use client";

import Link from "next/link";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { MarketPhoto } from "./market-intelligence-api";
import { AuthImage, DATE_FMT, DATETIME_FMT } from "./market-intelligence-media";

interface GalleryProps {
  readonly photos: MarketPhoto[];
  readonly setPhotos: Dispatch<SetStateAction<MarketPhoto[]>>;
  readonly actionConfig: ActionConfig;
  readonly onError: (message: string) => void;
}

export function MarketIntelligenceGallery({
  photos,
  setPhotos,
  actionConfig,
  onError,
}: GalleryProps) {
  const [photoSearch, setPhotoSearch] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<MarketPhoto | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<MarketPhoto | null>(null);

  const filteredPhotos = useMemo(() => {
    const q = photoSearch.trim().toLowerCase();
    if (!q) return photos;
    return photos.filter(
      (p) =>
        p.customerName.toLowerCase().includes(q) || p.customerCode.toLowerCase().includes(q),
    );
  }, [photos, photoSearch]);

  const photosByCustomer = useMemo(() => {
    const groups = new Map<string, { name: string; code: string; photos: MarketPhoto[] }>();
    for (const photo of filteredPhotos) {
      if (!groups.has(photo.customerId)) {
        groups.set(photo.customerId, {
          name: photo.customerName,
          code: photo.customerCode,
          photos: [],
        });
      }
      groups.get(photo.customerId)!.photos.push(photo);
    }
    return [...groups.entries()];
  }, [filteredPhotos]);

  async function handleDeletePhoto(photo: MarketPhoto) {
    try {
      await apiRequest(actionConfig, "DELETE", `/photos/${photo.id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setPreviewPhoto(null);
    } catch (e) {
      const message = errorMessage(e, "Could not delete the photo.");
      onError(message);
      throw new Error(message);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Field photos
        </h3>
        <Input
          value={photoSearch}
          onChange={(e) => setPhotoSearch(e.target.value)}
          placeholder="Search customer…"
          className="h-8 w-64"
        />
      </div>

      {photosByCustomer.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
          No market-intelligence photos yet — SEs capture them from the customer
          workspace in the mobile app.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {photosByCustomer.map(([custId, group]) => (
            <div key={custId} className="rounded-lg border border-border bg-white p-4">
              <div className="mb-3 flex items-baseline gap-2">
                <Link
                  href={`/customers/${custId}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {group.name}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">{group.code}</span>
                <span className="text-xs text-muted-foreground">
                  · {group.photos.length} photo{group.photos.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {group.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    className="group relative overflow-hidden rounded-lg border border-border"
                    title={`Uploaded ${DATE_FMT.format(new Date(photo.createdAt))} by ${photo.uploadedByName ?? "unknown"}`}
                  >
                    <AuthImage
                      photoId={photo.id}
                      config={actionConfig}
                      className="h-28 w-28 object-cover transition-transform group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Photo preview ── */}
      <Dialog open={previewPhoto !== null} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent size="xl">
          {previewPhoto && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {previewPhoto.customerName}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {previewPhoto.customerCode}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="p-0">
                <AuthImage
                  photoId={previewPhoto.id}
                  config={actionConfig}
                  className="max-h-[70vh] w-full object-contain"
                />
              </DialogBody>
              <DialogFooter className="sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Uploaded {DATETIME_FMT.format(new Date(previewPhoto.createdAt))} by{" "}
                  {previewPhoto.uploadedByName ?? "unknown"}
                </p>
                <Button variant="destructive" size="sm" onClick={() => setDeletingPhoto(previewPhoto)}>
                  <Trash2 size={14} className="mr-1" /> Delete photo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingPhoto !== null}
        onOpenChange={(open) => !open && setDeletingPhoto(null)}
        title="Delete photo?"
        description="This permanently removes the photo. It can't be undone."
        details={
          deletingPhoto ? (
            <p>
              <span className="font-medium">{deletingPhoto.customerName}</span>
              <span className="text-muted-foreground">
                {" "}
                · uploaded {DATE_FMT.format(new Date(deletingPhoto.createdAt))}
              </span>
            </p>
          ) : null
        }
        confirmLabel="Delete photo"
        onConfirm={() => handleDeletePhoto(deletingPhoto!)}
      />
    </section>
  );
}
