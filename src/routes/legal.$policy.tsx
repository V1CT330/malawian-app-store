import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

type PolicySection = { heading: string; paragraphs: string[]; bullets?: string[] };
type Policy = { title: string; updated: string; intro: string; sections: PolicySection[] };

const policies: Record<string, Policy> = {
  "terms-of-service": {
    title: "Terms of Service",
    updated: "27 October 2026",
    intro: "These terms govern your access to and use of Malawian App Store (MAS), including browsing listings, creating an account, reviewing products, and using marketplace features.",
    sections: [
      { heading: "1. About MAS and acceptance", paragraphs: ["MAS is a marketplace for discovering apps and websites. By accessing or using MAS, you agree to these Terms and the policies linked on this page. If you do not agree, do not use the service.", "MAS may be operated and improved over time. These terms do not promise uninterrupted availability, any particular number of listings, or that a product will remain available."] },
      { heading: "2. Accounts and eligibility", paragraphs: ["Provide accurate information, keep your sign-in credentials secure, and promptly correct material inaccuracies. You are responsible for activity carried out through your account, except to the extent caused by MAS or otherwise provided by applicable law.", "Developer features may require identity, ownership, or other verification. Verification is not a guarantee that a product is safe, lawful, or endorsed by MAS."] },
      { heading: "3. Marketplace listings and third-party products", paragraphs: ["Listings are supplied by developers or other third parties. Unless MAS expressly states otherwise, developers—not MAS—are responsible for their products, claims, licences, support, updates, and compliance with law.", "Review product descriptions and permissions carefully before installing, using, or paying for a product. MAS may review, label, limit, remove, or decline listings, but review does not guarantee that a product is free of defects or risk."] },
      { heading: "4. Acceptable use", paragraphs: ["You must comply with the Acceptable Use and Content Policy. Do not misuse the service, interfere with its security, misrepresent your identity, scrape or harvest data without permission, distribute malware, infringe rights, or attempt to bypass access controls."] },
      { heading: "5. Intellectual property", paragraphs: ["MAS and its branding, software, and original site materials are protected by applicable intellectual-property laws. You retain rights in content you own and submit, subject to the limited permissions needed to operate the service and any separate agreement you accept.", "Do not copy, redistribute, or exploit another party's materials without the rights or legal basis to do so. Reports of alleged infringement are handled under the Copyright and Takedown Policy."] },
      { heading: "6. Fees, subscriptions, and refunds", paragraphs: ["Some developer features may require a paid subscription. The price, billing period, applicable charges, and payment-provider fees should be shown before you confirm payment. Developer Pro is currently offered at MK5,000 per month, subject to the price shown at checkout.", "Cancellation stops future renewal where supported; access may continue through the already-paid period. Refund requests are handled under the Refund Policy and applicable law. Nothing in these terms removes rights that cannot legally be excluded."] },
      { heading: "7. Suspension and termination", paragraphs: ["MAS may restrict or suspend access where reasonably necessary to protect users, investigate suspected abuse, comply with law, enforce these terms, or protect the service. Where practical and appropriate, MAS will explain the reason and provide a way to contact support or request review.", "You may stop using MAS at any time. Account deletion requests and any legal retention obligations are addressed under the Privacy Notice."] },
      { heading: "8. Disclaimers and liability", paragraphs: ["To the extent permitted by applicable law, MAS is provided on an available basis and does not warrant that the service will be uninterrupted, error-free, or suitable for every purpose. Nothing in these terms excludes liability or consumer rights that cannot lawfully be excluded or limited.", "To the extent permitted by law, MAS is not responsible for independent third-party products or services. This does not excuse MAS from obligations imposed on it by applicable law."] },
      { heading: "9. Changes, complaints, and governing law", paragraphs: ["We may update these terms to reflect changes in the service, security, or legal requirements. We will update the date on this page and, where appropriate, provide notice. Material changes apply prospectively unless law permits otherwise.", "Please raise concerns through the support or reporting options available in MAS. These terms are intended to be governed by the laws of Malawi, subject to any mandatory legal protections that apply to you."] },
    ],
  },
  "privacy-notice": {
    title: "Privacy Notice",
    updated: "27 October 2026",
    intro: "This notice explains the categories of information MAS may process, why it is used, and the choices available to users. The exact data collected can vary with the features you use.",
    sections: [
      { heading: "1. Information you provide", paragraphs: ["Depending on your use of MAS, information may include account and profile details, developer submissions, product descriptions, support requests, reports, reviews, and verification status. Identity-verification providers may collect information directly under their own notices and workflows."] },
      { heading: "2. Information collected through use", paragraphs: ["MAS may process technical and usage information needed to operate the service, such as device/browser information, security logs, page and product interactions, listing views, and install or download events. Do not assume that every feature collects every category; collection depends on the feature and its configuration."] },
      { heading: "3. Purposes and legal basis", paragraphs: ["Information may be used to create and secure accounts, operate the marketplace, verify developers, process payments, provide analytics, prevent fraud and abuse, respond to reports, provide support, meet legal obligations, and improve reliability. Where applicable law requires a specific legal basis or consent, MAS should rely on the appropriate basis and respect your choices."] },
      { heading: "4. Sharing and service providers", paragraphs: ["Information may be shared with service providers needed to operate MAS, such as hosting, database, authentication, payment, analytics, and identity-verification providers; with other users where you choose to publish public profile or listing information; or where required to protect rights, safety, or comply with law.", "MAS does not promise that third-party providers process data under MAS's own systems. Their own terms and privacy notices may also apply. MAS should not sell personal information except as expressly disclosed and permitted by law."] },
      { heading: "5. Retention and security", paragraphs: ["Information is retained only for as long as reasonably needed for the purposes described, including account operation, security, dispute handling, accounting, and legal compliance. Retention periods may differ by data type and legal requirement.", "MAS uses reasonable administrative and technical safeguards appropriate to the service, but no online system can guarantee absolute security. If a data incident occurs, MAS will take appropriate steps required by applicable law."] },
      { heading: "6. Your choices and rights", paragraphs: ["Depending on applicable law, you may be able to request access to, correction of, deletion of, or a copy of personal information, object to certain processing, or withdraw consent where processing is based on consent. Some records may need to be retained for security, legal, or transactional reasons.", "Use the account settings or available support/reporting route to make a privacy request. We may need to verify your identity before acting on it."] },
      { heading: "7. Children and changes", paragraphs: ["MAS is not designed for children to provide personal information without any required permission or safeguards. If you believe a child has supplied personal information inappropriately, contact MAS through the available support route.", "We may update this notice as the service changes. The date above indicates the latest revision. This notice is a transparency statement and should be reviewed against MAS's actual production data flows before final publication."] },
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use and Content Policy",
    updated: "27 October 2026",
    intro: "This policy sets baseline rules for accounts, listings, reviews, messages, and other content on MAS. It applies alongside the Terms of Service and Developer Agreement.",
    sections: [
      { heading: "1. Prohibited content and conduct", paragraphs: ["Do not upload, publish, promote, or distribute content or products that:"], bullets: ["contain malware, spyware, credential theft, hidden surveillance, or intentionally harmful code;", "infringe copyright, trademarks, privacy, publicity, or other rights;", "facilitate fraud, impersonation, phishing, scams, or deceptive financial activity;", "contain unlawful threats, targeted harassment, exploitation, or non-consensual intimate material;", "promote illegal activity or provide instructions intended to cause serious harm;", "misrepresent functionality, permissions, pricing, ownership, verification, security testing, or endorsements;", "collect, expose, or misuse personal data without a valid basis and appropriate notice or permission;", "attempt to disrupt MAS, bypass access controls, manipulate ratings or analytics, or abuse payment or verification systems."] },
      { heading: "2. Accurate and transparent listings", paragraphs: ["Describe the product, developer identity, pricing, data practices, permissions, limitations, and support contact accurately. Do not claim that MAS has certified a product as safe merely because it is listed or a developer is verified.", "Only submit products you have the authority to distribute. Disclose known material risks and keep published versions and download links accurate."] },
      { heading: "3. Reviews and user contributions", paragraphs: ["Reviews and comments should reflect genuine experience and must not be bought, fabricated, spammed, or coordinated to manipulate rankings. Do not post private information or content unrelated to the product."] },
      { heading: "4. Reporting and enforcement", paragraphs: ["Users may report a listing or contribution through available reporting/support channels. Provide the relevant URL, a description of the concern, and supporting evidence where possible.", "MAS may investigate, request information, restrict visibility, remove content, suspend accounts, or refer matters to appropriate authorities where required. Enforcement should be proportionate to the risk and applicable law. Where practical, affected users may request review."] },
      { heading: "5. Security research", paragraphs: ["Do not exploit vulnerabilities against live users or systems, access data without authorization, or disrupt service. Report suspected security issues privately through the available support route and provide enough detail to reproduce the issue safely."] },
    ],
  },
  "copyright-takedown": {
    title: "Copyright and Takedown Policy",
    updated: "27 October 2026",
    intro: "MAS respects intellectual-property rights and provides a process for reporting content that you believe is infringing. Submitting a report does not automatically establish that a legal violation occurred.",
    sections: [
      { heading: "1. Submit a complete report", paragraphs: ["Use the available MAS support or reporting channel and include:"], bullets: ["your name and a reliable way to contact you;", "identification of the copyrighted work or other right you claim is infringed;", "the exact listing URL or location of the disputed material;", "an explanation of why you believe the use is unauthorized, plus evidence where available;", "a good-faith statement that the information is accurate and you are the rights holder or authorized to act for them."] },
      { heading: "2. Review and temporary action", paragraphs: ["MAS may acknowledge the report, request additional information, restrict access while investigating, or decline incomplete or clearly unsupported requests. MAS does not guarantee a particular response time or outcome."] },
      { heading: "3. Developer response and restoration", paragraphs: ["Where appropriate, MAS may notify the affected developer and allow a response, evidence of authorization, or a corrected submission. MAS may restore content if the issue is resolved or the report is not substantiated, subject to legal requirements."] },
      { heading: "4. Abuse of this process", paragraphs: ["False or knowingly misleading reports can harm legitimate creators and may result in account restrictions or legal consequences. Provide accurate information and do not use takedown requests to harass competitors."] },
      { heading: "5. Other rights and legal process", paragraphs: ["This process also supports reports about trademark, privacy, impersonation, and other rights, though the information required may differ. MAS may comply with valid legal orders and preserve relevant records where legally required. Nothing here limits rights or remedies available under applicable law."] },
    ],
  },
  "refund-policy": {
    title: "Refund Policy",
    updated: "27 October 2026",
    intro: "This policy explains how payment and refund requests should be handled on MAS. Refund eligibility depends on the product purchased, the payment provider, the transaction facts, and applicable law.",
    sections: [
      { heading: "1. Developer Pro subscriptions", paragraphs: ["Developer Pro is currently listed at MK5,000 per month, but the amount and any payment-provider fee displayed at checkout control the transaction. Check the checkout summary before confirming payment.", "Cancellation generally prevents future renewal where the payment system supports it. Access may continue until the end of the paid period. Cancellation alone does not necessarily create a refund for an already-started period."] },
      { heading: "2. Requesting a refund", paragraphs: ["Contact MAS through the available support route and provide the account used, transaction reference, payment date, amount, and reason for the request. Do not send passwords, full card numbers, or payment PINs.", "MAS may ask for reasonable information to verify the transaction and prevent fraud. If the payment was processed by a third-party provider, that provider's process and timelines may also apply."] },
      { heading: "3. Review factors", paragraphs: ["Requests may be assessed based on duplicate or unauthorized charges, technical failure that prevented the paid feature from being provided, billing errors, cancellation timing, and other relevant circumstances. Any discretionary decision is subject to applicable consumer and payment laws."] },
      { heading: "4. Non-excludable rights", paragraphs: ["Nothing in this policy removes a right to a refund, cancellation, chargeback, or other remedy that applicable law makes mandatory. If the law requires a remedy, this policy does not override it."] },
      { heading: "5. Timing and product purchases", paragraphs: ["Where a refund is approved, the timing of the credit depends on the payment provider and payment method. Purchases or subscriptions sold directly by third-party developers may need to be resolved with that developer unless MAS collected the payment or applicable law requires MAS to assist."] },
    ],
  },
  "developer-agreement": {
    title: "Developer Agreement",
    updated: "27 October 2026",
    intro: "This public summary is provided for reference. Developers must read and accept the full version of the MAS Developer Agreement presented in their account before using developer publishing features.",
    sections: [
      { heading: "1. Ownership and licence", paragraphs: ["Developers retain ownership of intellectual property they own. By submitting a product, a developer grants MAS only the limited, non-exclusive permission needed to host, display, review, test, distribute, and promote that product through the marketplace. Developers must have the rights and permissions needed to distribute every submitted asset and product."] },
      { heading: "2. Verification and publishing", paragraphs: ["Developer verification and Developer Pro do not guarantee publication, downloads, ranking, sales, or endorsement by MAS. Listings may be reviewed, declined, restricted, or removed under the Developer Agreement and marketplace policies."] },
      { heading: "3. Subscription and responsibilities", paragraphs: ["Developer Pro is currently offered at MK5,000 per month, subject to the amount shown at checkout. Developers are responsible for product accuracy, user support, security, privacy disclosures, third-party licences, and compliance with applicable law."] },
      { heading: "4. Full agreement controls", paragraphs: ["The version shown for acceptance in your account is the operative Developer Agreement. This summary does not replace it. If this page and the accepted agreement differ, consult the full accepted agreement and contact MAS through the available support route for clarification."] },
    ],
  },
};

export const Route = createFileRoute("/legal/$policy")({
  head: ({ params }) => ({
    meta: [
      { title: `${policies[params.policy]?.title ?? "Legal policies"} | Malawian App Store` },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: LegalPolicyPage,
});

function LegalPolicyPage() {
  const { policy: slug } = Route.useParams();
  const policy = policies[slug];

  return (
    <AppShell>
      <article className="mx-auto max-w-3xl py-6 sm:py-10">
        <Link to="/" className="text-sm text-primary hover:underline">← Back to store</Link>
        {policy ? (
          <>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">MAS policies</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">{policy.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: {policy.updated}</p>
            <p className="mt-6 text-base leading-7 text-foreground">{policy.intro}</p>
            <div className="mt-8 space-y-8">
              {policy.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-lg font-semibold text-foreground">{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-3 leading-7 text-muted-foreground">{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-muted-foreground">
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
            <div className="mt-10 border-t border-border pt-5">
              <h2 className="font-semibold text-foreground">Related policies</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {Object.entries(policies).filter(([key]) => key !== slug).map(([key, item]) => (
                  <a key={key} href={`/legal/${key}`} className="text-primary hover:underline">{item.title}</a>
                ))}
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">These policy drafts should be checked against MAS's actual production practices and reviewed by a qualified legal professional in Malawi before being treated as final legal documents.</p>
            </div>
          </>
        ) : (
          <div className="py-16">
            <h1 className="text-2xl font-bold text-foreground">Policy not found</h1>
            <p className="mt-3 text-muted-foreground">Choose a policy from the links below.</p>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              {Object.entries(policies).map(([key, item]) => <li key={key}><a className="text-primary hover:underline" href={`/legal/${key}`}>{item.title}</a></li>)}
            </ul>
          </div>
        )}
      </article>
    </AppShell>
  );
}
