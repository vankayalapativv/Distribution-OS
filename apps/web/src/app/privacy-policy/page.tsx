import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Distribution OS",
  description:
    "Privacy Policy for the Distribution OS app, published by Distribution OS Distribution Systems.",
};

// Static legal page — no auth, no data fetching. Served publicly at
// /privacy-policy (e.g. https://bdms.vardhansystems.in/privacy-policy) so it can
// be linked from the Google Play listing.
export const dynamic = "force-static";

const EFFECTIVE_DATE = "9 September 2026";
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

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Privacy Policy</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">{APP_NAME}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
          This Privacy Policy explains how <strong>{ENTITY}</strong> (&ldquo;{ENTITY}&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) collects, uses, and protects
          information in the <strong>{APP_NAME}</strong> mobile application (Android package{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px]">{PACKAGE}</code>,
          the &ldquo;App&rdquo;) published by {ENTITY} on Google Play, and in the associated web
          dashboard.
        </p>
        <p className="mt-2 text-sm text-slate-500">Effective date: {EFFECTIVE_DATE}</p>
      </header>

      <Section title="1. Who we are and who this app is for">
        <p>
          {APP_NAME} is a private business application provided by {ENTITY} to its own authorised
          field and office staff (sales executives, logistics staff, managers, accountants and
          administrators) to run day-to-day lubricant-distribution operations — customer visits,
          orders, collections, deliveries and field tracking. It is <strong>not</strong> a
          consumer application and is intended only for these authorised users. Accounts are
          created and managed by {ENTITY}&rsquo;s administrators.
        </p>
        <p>
          If you have any question about this policy or your data, contact us at{" "}
          <a className="font-medium text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="2. Information we collect">
        <p>We collect only the information needed to operate the App for our field-force workflow:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Account &amp; profile information</strong> — your name, mobile number, email
            address, assigned role and territory. This is created by your administrator when your
            account is set up.
          </li>
          <li>
            <strong>Location information (precise and background)</strong> — see the dedicated
            section below. Used to record your work-day route, verify customer visit check-ins, and
            calculate distance travelled.
          </li>
          <li>
            <strong>Camera and photos</strong> — photographs you capture or choose (for example of
            customer shops and shelves, and payment receipts or invoices) that you attach to
            customer, collection or task records.
          </li>
          <li>
            <strong>Business records you create in the App</strong> — orders, collections, visits,
            tasks, notes and similar operational data you enter as part of your work.
          </li>
          <li>
            <strong>Device and technical information</strong> — device model and operating-system
            version, app version, battery status, network connectivity, a push-notification token,
            and diagnostic/error logs. These help us deliver notifications and keep location
            tracking and the App reliable.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> collect data from children, and the App is not directed to
          anyone under 18. We do not use third-party advertising or analytics SDKs, and we do not
          build advertising profiles.
        </p>
      </Section>

      <Section title="3. Location data — precise and background collection">
        <p>
          The App collects <strong>precise location</strong>, including{" "}
          <strong>in the background</strong>, so that {ENTITY} can see a sales executive&rsquo;s
          route during the work day and verify field visits and attendance. Specifically:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Background location is recorded <strong>only during your work day</strong> — from when
            you tap <em>Start Day</em> until tracking automatically stops at 7:00 PM IST (or when you
            end the day). Logistics staff have their own defined tracking window.
          </li>
          <li>
            While tracking is active, the App runs a foreground service and shows a persistent
            notification so it is always clear that your location is being recorded.
          </li>
          <li>
            Location is also used at the moment you check in to a customer visit, to confirm the
            visit location.
          </li>
          <li>
            Location tracking requires you to grant the Android location permissions (including
            &ldquo;Allow all the time&rdquo; for background location). You can revoke these at any
            time in your device settings; doing so will stop route tracking and may limit visit
            check-in features.
          </li>
        </ul>
        <p>
          We use location data solely for the operational and workforce-management purposes above.
          We do not sell location data and do not use it for advertising.
        </p>
      </Section>

      <Section title="4. How we use information">
        <ul className="list-disc space-y-2 pl-6">
          <li>To operate the field-sales workflow — visits, orders, collections and deliveries.</li>
          <li>To verify customer visits and record work-day routes, distance and attendance.</li>
          <li>To send you work-related notifications (for example new invoices, alerts and reminders).</li>
          <li>To provide support, secure the service, prevent misuse, and fix problems.</li>
          <li>To meet legal, accounting and record-keeping obligations.</li>
        </ul>
      </Section>

      <Section title="5. How information is shared">
        <p>
          We do <strong>not</strong> sell your personal information and do <strong>not</strong>{" "}
          share it for advertising. Information is shared only with the service providers that
          host and run the App on our behalf, and only as needed to provide the service:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Cloudflare</strong> — application hosting and secure file/object storage (for
            uploaded photos and PDFs).
          </li>
          <li>
            <strong>Neon</strong> — the managed PostgreSQL database that stores the App&rsquo;s
            records.
          </li>
          <li>
            <strong>Expo and Google Firebase Cloud Messaging (FCM)</strong> — to deliver push
            notifications.
          </li>
          <li>
            <strong>Google (Maps &amp; Play services)</strong> — to display maps and support
            location features on the mobile app.
          </li>
        </ul>
        <p>
          These providers process data under their own security and privacy terms. We may also
          disclose information if required by law, regulation, legal process, or to protect our
          rights and safety.
        </p>
      </Section>

      <Section title="6. Data retention">
        <p>
          We keep your information for as long as your account is active and for as long as needed
          to provide the service and to meet our legal, tax and business-record obligations. When
          information is no longer required, we delete or anonymise it. Because accounts are managed
          by {ENTITY}&rsquo;s administrators, some records are retained as part of the
          company&rsquo;s business records even after individual access ends.
        </p>
      </Section>

      <Section title="7. Data security">
        <p>
          Data is transmitted over encrypted connections (HTTPS/TLS). Access to stored data is
          restricted to authorised personnel and systems, and files are held in access-controlled
          storage. No method of transmission or storage is completely secure, but we take
          reasonable technical and organisational measures to protect your information.
        </p>
      </Section>

      <Section title="8. Your rights and how to request data deletion">
        <p>
          You may request access to, correction of, or deletion of your personal information. To
          make a request — including a request to delete your data — email us at{" "}
          <a className="font-medium text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          from your registered email or contact your administrator. We will respond within a
          reasonable time. Note that some data must be retained where required for legal,
          accounting or legitimate business-record purposes, and that account and business records
          are administered by {ENTITY}.
        </p>
        <p>
          You can also control permissions (location, camera) at any time through your device
          settings.
        </p>
      </Section>

      <Section title="9. Children&rsquo;s privacy">
        <p>
          The App is a workforce tool intended only for {ENTITY}&rsquo;s authorised staff and is not
          directed to, or intended for use by, children. We do not knowingly collect data from
          children under 18.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. The &ldquo;Effective date&rdquo; at
          the top shows when it was last revised. Material changes will be reflected here and, where
          appropriate, communicated to users.
        </p>
      </Section>

      <Section title="11. Contact us">
        <p>
          For any privacy question, data request, or grievance, contact the Grievance Officer:
        </p>
        <p className="text-slate-800">
          <strong>{ENTITY}</strong>
          <br />
          India
          <br />
          Email:{" "}
          <a className="font-medium text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-sm text-slate-500">This policy is governed by the laws of India.</p>
      </Section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        © {new Date().getFullYear()} {ENTITY}. {APP_NAME} and all associated data are operated by{" "}
        {ENTITY}.
      </footer>
    </main>
  );
}
