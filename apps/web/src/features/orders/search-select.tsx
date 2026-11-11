"use client";

/**
 * Re-export shim. `SearchSelect` now lives at `@/components/ui/search-select`
 * (promoted 2026-11-01 as the canonical searchable dropdown). Existing imports
 * keep working; new code should import from the ui path directly.
 */
export { SearchSelect } from "@/components/ui/search-select";
