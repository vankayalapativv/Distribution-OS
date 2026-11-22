"use client";

import { type RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionConfig } from "@/lib/api-client";
import { BrandField } from "./brand-field";
import { FieldError, fieldErrorProps } from "./field-error";
import type { ProductField } from "./product-form-logic";
import type { ProductForm } from "./use-product-form";

/** Whether a field's error should show (touched + has an error) + its message. */
function shownErr(f: ProductForm, field: ProductField) {
  return { show: Boolean(f.touched[field] && f.fieldErrors[field]), message: f.fieldErrors[field] };
}

/** The shared Product-Name / Brand / HSN fields — laid out by each parent (the
 *  edit form puts brand+HSN in a grid; the wizard stacks them). */
export function ProductNameField({
  f, idPrefix, inputRef, autoFocus,
}: Readonly<{ f: ProductForm; idPrefix: string; inputRef: RefObject<HTMLInputElement | null>; autoFocus?: boolean }>) {
  const { show, message } = shownErr(f, "name");
  const id = `${idPrefix}-name`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Product Name <span className="text-destructive">*</span></Label>
      <Input
        ref={inputRef}
        value={f.productName}
        onChange={(e) => { f.setProductName(e.target.value); f.touch("name"); }}
        onBlur={() => f.touch("name")}
        placeholder="e.g. Fuchs 10W-40"
        autoFocus={autoFocus}
        {...fieldErrorProps(id, show, message)}
      />
      <FieldError id={id} show={show} message={message} />
    </div>
  );
}

export function ProductBrandFieldRow({
  f, idPrefix, wrapRef, actionConfig,
}: Readonly<{ f: ProductForm; idPrefix: string; wrapRef: RefObject<HTMLDivElement | null>; actionConfig: ActionConfig }>) {
  const { show, message } = shownErr(f, "brand");
  return (
    <div ref={wrapRef} className="flex flex-col gap-1.5">
      <BrandField category="oils" value={f.brand} onChange={(v) => { f.setBrand(v); f.touch("brand"); }} actionConfig={actionConfig} />
      <FieldError id={`${idPrefix}-brand`} show={show} message={message} />
    </div>
  );
}

export function ProductHsnField({
  f, idPrefix, inputRef,
}: Readonly<{ f: ProductForm; idPrefix: string; inputRef: RefObject<HTMLInputElement | null> }>) {
  const { show, message } = shownErr(f, "hsnCode");
  const id = `${idPrefix}-hsn`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label>HSN Code <span className="text-destructive">*</span></Label>
      <Input
        ref={inputRef}
        value={f.hsnCode}
        onChange={(e) => { f.setHsnCode(e.target.value.replace(/[^\d]/g, "")); f.touch("hsnCode"); }}
        onBlur={() => f.touch("hsnCode")}
        inputMode="numeric"
        maxLength={8}
        placeholder="e.g. 27101980"
        {...fieldErrorProps(id, show, message)}
      />
      <FieldError id={id} show={show} message={message} />
    </div>
  );
}
