import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, OPERATOR_NAME } from './legalInfo';
import { PRIVACY_HREF } from '../navigation/publicRoute';

/** Terms of Use: what the service is, what it is not, and the rules for using it. */
export function TermsOfUse() {
  const mailto = `mailto:${CONTACT_EMAIL}`;
  return (
    <article className="legal">
      <header className="legal-header">
        <p className="eyebrow">Legal</p>
        <h1>Terms of Use</h1>
        <p className="legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>
        <p className="legal-lead">
          These terms are the agreement between you and {OPERATOR_NAME} for using Libreng Invoice. By creating an account
          or using the app, you agree to them. Please read them, especially sections 3, 4 and 8.
        </p>
      </header>

      <section className="legal-section" aria-labelledby="terms-service">
        <h2 id="terms-service">1. The service</h2>
        <p>
          Libreng Invoice lets you make, save, download and email invoices, quotations, acknowledgement receipts and
          delivery receipts. It is free. We may add, change or remove features, set usage limits, or stop the service,
          and we will try to give notice before any major change so you can download your data.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-account">
        <h2 id="terms-account">2. Your account</h2>
        <ul>
          <li>You must be at least 18 years old, and the information you give us must be true.</li>
          <li>Keep your password private. You are responsible for what happens in your account.</li>
          <li>
            If you use the app for a business, you confirm you are allowed to act for that business.
          </li>
          <li>Tell us right away at <a href={mailto}>{CONTACT_EMAIL}</a> if you think someone else used your account.</li>
        </ul>
      </section>

      <section className="legal-section legal-important" aria-labelledby="terms-bir">
        <h2 id="terms-bir">3. Not BIR official receipts or invoices</h2>
        <p>
          Documents made with Libreng Invoice are <strong>not BIR-registered official receipts or sales invoices</strong>,
          and using the app does not register your business or your documents with the Bureau of Internal Revenue. They
          are for billing, quotations and your own records. Each document prints “This document is not an official
          receipt.” by default.
        </p>
        <p>
          <strong>You are responsible for your own tax and legal obligations</strong>, including registering your
          business, issuing BIR-registered receipts or invoices when the law requires them, and keeping your records. The
          app does not give tax, accounting or legal advice. If you are unsure what you need, ask the BIR or an
          accountant.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-accuracy">
        <h2 id="terms-accuracy">4. Check your documents</h2>
        <p>
          The app calculates totals, conversions, discounts and balances from what you type. We work hard to make these
          correct, but <strong>you are responsible for checking every document before you send or rely on it</strong>,
          including amounts, customer details, dates and payment information.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-rules">
        <h2 id="terms-rules">5. What you may not do</h2>
        <p>You agree not to use Libreng Invoice to:</p>
        <ul>
          <li>make fake, forged or misleading documents, or pretend to be another person or business;</li>
          <li>defraud, scam or deceive anyone, or bill for goods or services that are illegal;</li>
          <li>send spam, phishing, or emails to people who did not expect a document from you;</li>
          <li>upload content that is unlawful, infringing, or that you have no right to use (for example someone else’s logo);</li>
          <li>collect or use other people’s personal information against the Data Privacy Act;</li>
          <li>
            break, overload or get around the app’s security or limits, access other people’s accounts or data, or copy the
            service with automated tools.
          </li>
        </ul>
        <p>
          We may suspend or close accounts that break these rules, remove content that breaks them, and report illegal
          activity to the authorities.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-email">
        <h2 id="terms-email">6. Emails you send</h2>
        <p>
          When you send a document from the app, the email is delivered by our email provider under your business name,
          with a copy to your account email and replies going to you. You are the sender: you are responsible for who you
          send to and what you write. Sending is limited per day, and we may switch it off for an account that misuses it.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-content">
        <h2 id="terms-content">7. Your content</h2>
        <p>
          Your documents, business details and logo remain yours. You allow us to store, display, copy and send them only
          as needed to run the service for you. You can download all of it with “Download backup” and delete it at any
          time. How we handle personal information is explained in the <a href={PRIVACY_HREF}>Privacy Policy</a>.
        </p>
      </section>

      <section className="legal-section legal-important" aria-labelledby="terms-warranty">
        <h2 id="terms-warranty">8. No warranty, and limits on our liability</h2>
        <p>
          Libreng Invoice is free and provided <strong>“as is” and “as available”</strong>. We do not promise that it will
          always be available, error-free, or that data will never be lost. Keep your own backups of anything important.
        </p>
        <p>
          To the fullest extent allowed by Philippine law, we are not liable for indirect or consequential losses, such as
          lost profits, lost sales, tax penalties, or disputes with your customers, that come from using or not being able
          to use the app, or from documents you made with it. Nothing in these terms limits liability that cannot be
          limited by law, such as for fraud or gross negligence.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-end">
        <h2 id="terms-end">9. Ending your use</h2>
        <p>
          You can stop using the app and delete your account at any time in My business. We may close accounts that break
          these terms, or that have been inactive for a long time after notice. Download a backup before your account is
          deleted; deletion cannot be undone.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-changes">
        <h2 id="terms-changes">10. Changes to these terms</h2>
        <p>
          We may update these terms. We will change the date at the top, and for important changes we will tell you in
          the app or by email before they take effect. If you keep using the app after that, you accept the new terms.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-law">
        <h2 id="terms-law">11. Governing law</h2>
        <p>
          These terms are governed by the laws of the Republic of the Philippines. Before going to court, please contact us
          so we can try to resolve the matter informally.
        </p>
      </section>

      <section className="legal-section legal-contact" aria-labelledby="terms-contact">
        <h2 id="terms-contact">12. Contact</h2>
        <p>
          Questions about these terms: <a href={mailto}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </article>
  );
}
