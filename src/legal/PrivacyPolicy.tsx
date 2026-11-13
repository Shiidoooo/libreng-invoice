import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, OPERATOR_NAME, SERVICE_PROVIDERS } from './legalInfo';
import { TERMS_HREF } from '../navigation/publicRoute';

/**
 * Privacy Policy, written for the Philippine Data Privacy Act of 2012 (Republic Act No.
 * 10173), its Implementing Rules and National Privacy Commission issuances.
 */
export function PrivacyPolicy() {
  const mailto = `mailto:${CONTACT_EMAIL}`;
  return (
    <article className="legal">
      <header className="legal-header">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>
        <p className="legal-lead">
          This policy explains what personal information Libreng Invoice collects, why, who handles it, how long it is
          kept, and the rights you have under the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>.
          We keep it short and in plain language. If anything is unclear, email us at{' '}
          <a href={mailto}>{CONTACT_EMAIL}</a>.
        </p>
      </header>

      <section className="legal-section" aria-labelledby="privacy-who">
        <h2 id="privacy-who">1. Who we are</h2>
        <p>
          Libreng Invoice is a free web app for making invoices, quotations and receipts. It is run by{' '}
          <strong>{OPERATOR_NAME}</strong> (“we”, “us”). For the information about <em>you</em> as a user, we are the
          personal information controller. Our data protection contact, who also acts as our Data Protection Officer,
          can be reached at <a href={mailto}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-collect">
        <h2 id="privacy-collect">2. What we collect</h2>
        <dl className="legal-list">
          <div>
            <dt>Your account</dt>
            <dd>
              Your email address and a password. Passwords are stored scrambled (hashed) by our sign-in provider; nobody,
              including us, can read them. If you use “Continue with Google”, we receive your email address, name and
              profile picture link from Google, never your Google password.
            </dd>
          </div>
          <div>
            <dt>Your business details</dt>
            <dd>
              What you enter in My business: business or personal name, address, phone, email, logo, payment details
              (for example a GCash number or bank account), your email message template, and your TIN if you choose to add
              it. A TIN is a government-issued number, so treat it with care; it is optional and only printed when filled in.
            </dd>
          </div>
          <div>
            <dt>Your documents</dt>
            <dd>
              The invoices, quotations and receipts you save, including the items, amounts, notes and the{' '}
              <strong>customer details you type in</strong> (name, address, phone or email).
            </dd>
          </div>
          <div>
            <dt>Emails you send from the app</dt>
            <dd>
              When you press “Send email with PDF”, the recipient’s address, the subject, the message and the PDF pass
              through our server to our email provider for delivery. We keep only the time of each send, to enforce
              the daily limit. We do not keep the recipient, the message or the PDF.
            </dd>
          </div>
          <div>
            <dt>Error notes</dt>
            <dd>
              When something fails, we record a short technical note linked to your account: what failed, the page you
              were on and your browser type. It never includes your documents, customers or passwords.
            </dd>
          </div>
          <div>
            <dt>Technical data</dt>
            <dd>
              Like any website, our hosting and database providers process your IP address and basic request details
              to deliver the service and keep it secure.
            </dd>
          </div>
        </dl>
        <p>
          We do <strong>not</strong> use advertising, analytics or tracking cookies, we do not sell your data, and we
          never ask for card or bank log-in details.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-why">
        <h2 id="privacy-why">3. Why we use it, and on what basis</h2>
        <ul>
          <li>
            <strong>To provide the service you signed up for:</strong> to let you sign in, save and open your documents on
            any device, make PDFs and send emails you ask us to send. This is necessary to fulfil our agreement with you
            (the <a href={TERMS_HREF}>Terms of Use</a>).
          </li>
          <li>
            <strong>To keep it safe and working:</strong> rate limits, abuse prevention and error notes. This is our
            legitimate interest in running a secure service.
          </li>
          <li>
            <strong>To meet legal obligations,</strong> for example responding to lawful requests from authorities.
          </li>
        </ul>
        <p>We do not use your information for marketing, profiling or automated decisions about you.</p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-customers">
        <h2 id="privacy-customers">4. Your customers’ information</h2>
        <p>
          When you put a customer’s name, address or contact on a document, <strong>you</strong> decide what to collect
          and why, so you are responsible for it as their personal information controller. We only store and process it to
          provide the service to you, as your processor. Please collect only what you need for billing, keep it accurate,
          and only email documents to people who expect them.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-share">
        <h2 id="privacy-share">5. Who handles your information</h2>
        <p>
          We use these providers to run the app. They process data only on our instructions and under their own
          security and privacy commitments. Some are outside the Philippines; by using the app you understand that your
          information will be stored and processed in these locations. We remain responsible for it under Philippine law.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">What it does</th>
                <th scope="col">Where</th>
              </tr>
            </thead>
            <tbody>
              {SERVICE_PROVIDERS.map((provider) => (
                <tr key={provider.name}>
                  <th scope="row">{provider.name}</th>
                  <td>{provider.role}</td>
                  <td>{provider.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The people you email a document to receive what you send them. Apart from this, we only disclose information
          when required by law or a lawful order.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-keep">
        <h2 id="privacy-keep">6. How long we keep it</h2>
        <ul>
          <li>
            <strong>Account, business details and documents:</strong> until you delete them or delete your account.
          </li>
          <li>
            <strong>Error notes:</strong> 90 days.
          </li>
          <li>
            <strong>Email send times:</strong> 7 days.
          </li>
          <li>
            <strong>When you delete your account,</strong> your account, business details, documents and the notes above
            are erased right away. Copies in our providers’ backups, if any, are removed when those backups expire.
          </li>
        </ul>
        <p>
          You are responsible for keeping your own business records for as long as the law requires you to (for example
          for tax purposes). Use “Download backup” in My business to keep a copy.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-protect">
        <h2 id="privacy-protect">7. How we protect it</h2>
        <ul>
          <li>Every connection is encrypted (HTTPS).</li>
          <li>
            The database itself checks every request, so each account can only read and change its own records. Visitors
            who are not signed in get nothing.
          </li>
          <li>Secret keys are kept on the server, never in the website’s code.</li>
          <li>Limits on how often and how much can be saved or sent help stop abuse.</li>
        </ul>
        <p>
          No system is perfectly secure. If a personal data breach happens that is likely to harm you, we will notify you
          and the National Privacy Commission as the law requires, generally within 72 hours of finding out.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">8. Your rights</h2>
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul>
          <li>
            <strong>Be informed</strong> about how your information is used (this policy);
          </li>
          <li>
            <strong>Access</strong> your information. Everything you entered is visible in the app;
          </li>
          <li>
            <strong>Correct</strong> it. Edit your business details and documents at any time;
          </li>
          <li>
            <strong>Erase or block</strong> it. Delete documents, or delete your account in My business;
          </li>
          <li>
            <strong>Data portability.</strong> Download all your data with “Download backup” in My business;
          </li>
          <li>
            <strong>Object</strong> to processing, and <strong>withdraw</strong> from the service at any time;
          </li>
          <li>
            <strong>Be compensated</strong> for damages caused by inaccurate, unlawfully obtained or unauthorized use of
            your information; and
          </li>
          <li>
            <strong>File a complaint</strong> with the National Privacy Commission (privacy.gov.ph).
          </li>
        </ul>
        <p>
          For anything you can’t do in the app, email <a href={mailto}>{CONTACT_EMAIL}</a> from the email address of
          your account. We may ask you to confirm it is you, and we aim to reply within 15 days.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-storage">
        <h2 id="privacy-storage">9. What the app stores in your browser</h2>
        <ul>
          <li>
            <strong>Your sign-in session,</strong> so you stay signed in. It is removed when you sign out.
          </li>
          <li>
            <strong>Your light or dark mode choice.</strong>
          </li>
          <li>
            <strong>An unsaved document,</strong> only in the current tab, so a refresh doesn’t lose your work. It is
            cleared when you close the tab.
          </li>
        </ul>
        <p>These are needed for the app to work. There are no advertising or tracking cookies.</p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-age">
        <h2 id="privacy-age">10. Age</h2>
        <p>
          Libreng Invoice is a business tool for people 18 and older. It is not meant for children, and we do not knowingly
          collect their information.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-changes">
        <h2 id="privacy-changes">11. Changes to this policy</h2>
        <p>
          If we change this policy, we will update the date at the top. If the change is significant, we will tell you in
          the app or by email before it takes effect.
        </p>
      </section>

      <section className="legal-section legal-contact" aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">12. Contact us</h2>
        <p>
          Questions, requests or complaints about your personal information: <a href={mailto}>{CONTACT_EMAIL}</a>. If you
          are not satisfied with our answer, you may contact the National Privacy Commission at privacy.gov.ph.
        </p>
      </section>
    </article>
  );
}
