/**
 * Photo helpers, split by concern to keep each file small:
 *  - photo-picker: camera/gallery capture (shared: New Customer, Market Intel, delivery)
 *  - photo-files:  persist to the document dir until the sync queue uploads
 *  - photo-upload: multipart uploads to the API
 * This barrel keeps the public `./photos` import path stable for every caller.
 */
export type { PickedPhoto } from "./photo-picker";
export { pickFromCamera, pickFromGallery } from "./photo-picker";
export { persistProofPhoto, persistDeliveryPhoto, deleteProofPhoto } from "./photo-files";
export type { PhotoCategory, PhotoGeo } from "./photo-upload";
export { uploadCollectionProof, uploadDeliveryPhoto, uploadCustomerPhoto } from "./photo-upload";
