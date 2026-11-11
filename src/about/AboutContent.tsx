/** What the app is, who it is for and how data is handled. Shown on the About page and from the sign-in screen. */
export function AboutContent() {
  return (
    <div className="about">
      <section className="about-section">
        <h3>What is Libreng Invoice?</h3>
        <p>
          A free tool for making invoices, quotations and receipts, built for sari-sari stores, small businesses and
          freelancers in the Philippines. No subscription and no hidden fees to download your documents.
        </p>
      </section>

      <section className="about-section">
        <h3>What you can make</h3>
        <ul className="about-list">
          <li>
            <strong>Invoice</strong>: ask a customer to pay, with a due date and any down payment.
          </li>
          <li>
            <strong>Quotation</strong>: give a price before the work starts.
          </li>
          <li>
            <strong>Acknowledgement Receipt</strong>: confirm you received a payment.
          </li>
          <li>
            <strong>Delivery Receipt</strong>: list the items you delivered, with a signature line.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>How to use it</h3>
        <ol className="about-list">
          <li>
            Open <strong>My business</strong> and add your business name, address and GCash or bank details.
          </li>
          <li>
            Go to <strong>Create</strong>, choose what you are making, and add your customer and items.
          </li>
          <li>
            Press <strong>Save &amp; get PDF</strong>, then choose “Save as PDF” in the print window to download it, or
            print it directly.
          </li>
          <li>
            Find everything again in <strong>My documents</strong>, where you can see who still owes you and mark
            invoices as paid.
          </li>
        </ol>
      </section>

      <section className="about-section">
        <h3>Your data</h3>
        <ul className="about-list">
          <li>Your documents are saved to your account, so you can open them on your phone or computer.</li>
          <li>Only you can see your documents. Each account is kept separate by the database itself.</li>
          <li>You can download a backup at any time, and delete your account and all its data in My business.</li>
          <li>We do not sell your data or show ads.</li>
          <li>
            When something goes wrong, we keep a short technical note (what failed, the page and your browser type) for 90
            days so we can fix it. It never includes your documents or passwords.
          </li>
        </ul>
      </section>

      <section className="about-section about-notice">
        <h3>Important</h3>
        <p>
          Documents made here are <strong>not BIR-registered official receipts or sales invoices</strong>. They are
          useful for billing, quotations and record keeping. If your business is VAT-registered or must issue official
          receipts, use your BIR-registered receipts or system for that.
        </p>
      </section>
    </div>
  );
}
