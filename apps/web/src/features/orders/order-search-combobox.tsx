"use client";

/**
 * Re-export shim. The combobox now lives at `@/components/ui/search-combobox`
 * (promoted 2026-11-01). Existing imports of `OrderSearchCombobox` keep working;
 * new code should import `SearchCombobox` from the ui path directly.
 */
export { SearchCombobox as OrderSearchCombobox } from "@/components/ui/search-combobox";
