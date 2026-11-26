import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteProofPhoto, persistDeliveryPhoto, persistProofPhoto } from "./photo-files";
import type { PickedPhoto } from "./photo-picker";

const h = vi.hoisted(() => {
  const dirState = { exists: false };
  const destState = { exists: false };
  const createSpy = vi.fn();
  const destDeleteSpy = vi.fn();
  const copySpy = vi.fn();
  const looseFiles = new Map<string, { exists: boolean; delete: () => void }>();
  class Directory {
    dirName: string;
    constructor(_base: unknown, name: string) { this.dirName = name; }
    get exists() { return dirState.exists; }
    create(...a: unknown[]) { createSpy(...a); }
  }
  class File {
    uri: string;
    isDest: boolean;
    constructor(a: Directory | string, b?: string) {
      this.isDest = b !== undefined;
      this.uri = b !== undefined ? `doc/${(a as Directory).dirName}/${b}` : (a as string);
    }
    get exists() { return this.isDest ? destState.exists : (looseFiles.get(this.uri)?.exists ?? false); }
    delete() { if (this.isDest) destDeleteSpy(); else looseFiles.get(this.uri)?.delete(); }
    copySync(dest: File) { copySpy(dest.uri); }
  }
  return { dirState, destState, createSpy, destDeleteSpy, copySpy, looseFiles, Directory, File };
});
vi.mock("expo-file-system", () => ({ Directory: h.Directory, File: h.File, Paths: { document: "doc" } }));

const photo = (type: string): PickedPhoto => ({ uri: "file://src.x", name: "n", type });
beforeEach(() => { h.dirState.exists = false; h.destState.exists = false; h.looseFiles.clear(); });
afterEach(() => vi.clearAllMocks());

describe("persistProofPhoto / persistDeliveryPhoto", () => {
  it("creates the dir when missing and returns the jpeg dest uri", () => {
    const uri = persistProofPhoto("cu1", photo("image/jpeg"));
    expect(h.createSpy).toHaveBeenCalledWith({ intermediates: true, idempotent: true });
    expect(h.copySpy).toHaveBeenCalledWith("doc/proofs/cu1.jpg");
    expect(uri).toBe("doc/proofs/cu1.jpg");
  });
  it("skips dir create when it exists and picks the extension from the mime type", () => {
    h.dirState.exists = true;
    expect(persistDeliveryPhoto("run-start", photo("image/png"))).toBe("doc/deliveries/run-start.png");
    expect(h.createSpy).not.toHaveBeenCalled();
    expect(persistDeliveryPhoto("run-end", photo("image/webp"))).toBe("doc/deliveries/run-end.webp");
  });
  it("deletes a pre-existing destination before copying", () => {
    h.destState.exists = true;
    persistProofPhoto("cu2", photo("image/jpeg"));
    expect(h.destDeleteSpy).toHaveBeenCalled();
  });
});

describe("deleteProofPhoto", () => {
  it("deletes an existing file", () => {
    const del = vi.fn();
    h.looseFiles.set("doc/proofs/old.jpg", { exists: true, delete: del });
    deleteProofPhoto("doc/proofs/old.jpg");
    expect(del).toHaveBeenCalled();
  });
  it("no-ops when the file is already gone", () => {
    expect(() => deleteProofPhoto("doc/proofs/missing.jpg")).not.toThrow();
  });
  it("swallows a delete error", () => {
    h.looseFiles.set("doc/proofs/locked.jpg", {
      exists: true,
      delete: () => { throw new Error("locked"); },
    });
    expect(() => deleteProofPhoto("doc/proofs/locked.jpg")).not.toThrow();
  });
});
