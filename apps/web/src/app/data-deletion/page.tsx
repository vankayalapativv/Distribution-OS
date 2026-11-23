import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data & Account Deletion — Distribution OS",
  description:
    "How to request deletion of your account and associated data in the Distribution OS app, published by Distribution OS Distribution Systems.",
};

// Static legal page — no auth, no data fetching. Served publicly at
// /data-deletion so it can be linked from the Google Play listing / Data safety
// form (Google's account & data deletion requirement).
export const dynamic = "force-static";

const EFFECTIVE_DATE = "24 November 2026";
const ENTITY = "Distribution OS Distribution Systems";
const APP_NAME = "Distribution OS";
const PACKAGE = "com.vardhansystems.distributionos";
const CONTACT_EMAIL = "support@vardhansystems.in";

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Data &amp; Account Deletion</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">{APP_NAME}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
          This page explains how to request deletion of your account and associated data in the{" "}
          <strong>{APP_NAME}</strong> mobile application (Android package{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px]">{PACKAGE}</code>),
          published by <strong>{ENTITY}</strong> on Google Play.
        </p>
        <p className="mt-2 text-sm text-slate-500">Effective date: {EFFECTIVE_DATE}</p>
      </header>

      <Section title="A business app with organization-managed accounts">
        <p>
          {APP_NAME} is a private business application used only by {ENTITY}&rsquo;s authorised field
          and office staff (sales executives, logistics staff and administrators). It is{" "}
          <strong>not</strong> a consumer application, and users cannot create their own accounts in
          the app. Each account is created, assigned and managed by the user&rsquo;s{" "}
          <strong>organization administrator</strong>.
        </p>
      </Section>

      <Section title="How to request deletion of your account and data">
        <p>You can request deletion of your account and the personal data associated with it in either of these ways:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Email us</strong> at{" "}
            <a className="font-medium text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{" "}
            from your registered email address, with the subject &ldquo;Data deletion request&rdquo; and
            your name and organization. We may contact you to verify your identity before processing the request.
          </li>
          <li>
            <strong>Ask your organization administrator</strong>, who can deactivate and remove your
            account directly from the {APP_NAME} web console.
          </li>
        </ul>
      </Section>

      <Section title="What is deleted">
        <p>
          On a verified request we delete your <strong>user account</strong> and the personal data tied
          to it, including your profile details (name, email, phone), your device and push-notification
          tokens, and your collected location history. This typically completes within{" "}
          <strong>30 days</strong>.
        </p>
        <p>
          Business records that you created while doing your job — such as customer records, orders,
          collections, deliveries and photos — belong to your organization, not to you personally. These
          are retained by the organization for its own operational, accounting and legal purposes, and may
          be kept after your individual account is deleted. To request deletion of those organization records,
          the organization&rsquo;s administrator should contact us.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For any question about data or account deletion, contact{" "}
          <a className="font-medium text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
