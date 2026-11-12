import type { ReactNode } from 'react';
import { MAX_LOGO_FILE_BYTES } from '../business/logo';
import { MAX_LINE_ITEMS } from '../invoices/draft';
import { DOCUMENT_KIND_CONFIG } from '../invoices/documentKinds';
import { DOCUMENT_KINDS, type DocumentKind } from '../invoices/types';
import { CURRENCIES } from '../money/money';

interface AboutPageProps {
  /** The button that ends the hero and the page: "Create an account" when signed out, "Make a document" when signed in. */
  callToAction: ReactNode;
}

/** What each document is for and what is printed on it, in the seller's words. */
const DOCUMENT_GUIDE: Record<DocumentKind, { when: string; includes: string }> = {
  invoice: {
    when: 'You delivered goods or finished a job and the customer still has to pay.',
    includes: 'Items and total, due date, your GCash or bank details, any down payment and the balance left. Shows a PAID stamp once fully paid.',
  },
  quotation: {
    when: 'A customer asks “magkano?” before ordering, and you want the price in writing.',
    includes: 'Items and total, a “valid until” date, your payment details and a line for the customer to sign when they agree.',
  },
  acknowledgement_receipt: {
    when: 'A customer paid you and wants proof that you received the money.',
    includes: 'What was paid for, the amount received and a line for your signature.',
  },
  delivery_receipt: {
    when: 'You are dropping off goods and want the customer to confirm they got everything.',
    includes: 'The list of items delivered with quantities, and a line for the person who received them to sign.',
  },
};

const STEPS = [
  {
    title: 'Set up your business once',
    body: 'In My business, add your business name, address, logo and how customers can pay you (GCash, Maya, bank). They appear on every document from then on.',
  },
  {
    title: 'Fill in the document',
    body: 'Choose what you are making, pick or type the customer, and add your items. The total updates as you type, and a live preview shows exactly what your customer will get.',
  },
  {
    title: 'Save it and get the PDF',
    body: 'Press “Save & get PDF”. The number is assigned for you (INV-2026-0001, 0002, …), and the PDF is saved to your Downloads. A printer button is there if you want paper.',
  },
  {
    title: 'Send it and keep track',
    body: 'Press Email to send it with your own message. Later, find it in My documents, see who still owes you and mark invoices as paid.',
  },
];

const FEATURES = [
  {
    title: 'Sell by kilo, gram or liter',
    body: 'Sold 500 g but your price is per kilo? Enter both and the amount is worked out for you. The same goes for mL and L.',
  },
  {
    title: 'Or just type the amount',
    body: 'For suki prices and round-offs, tick “Type the amount myself” and enter what you actually charged.',
  },
  {
    title: 'Discounts, fees and down payments',
    body: 'Take off a percent or a fixed amount, add a delivery or rush fee, record a down payment and show the balance still due.',
  },
  {
    title: 'Numbers that never repeat',
    body: 'Each type of document counts on its own and starts again every year. You can type your own number too; the same one is never used twice.',
  },
  {
    title: 'Email it with the PDF',
    body: 'Opens your own Gmail or email app with a ready message you can edit. On a phone the PDF is attached for you. It is sent from your address, not ours.',
  },
  {
    title: 'See who still owes you',
    body: 'My documents adds up what is still to be collected, and lets you filter unpaid invoices and mark them paid in one tap.',
  },
  {
    title: 'Your customers, remembered',
    body: 'Start typing a past customer’s name and their address and contact are filled in for you.',
  },
  {
    title: 'Made for phones',
    body: 'Big buttons, a save bar that stays within thumb reach, and light or dark mode. It works the same on a computer.',
  },
];

const FAQ: { question: string; answer: ReactNode }[] = [
  {
    question: 'Is it really free?',
    answer: 'Yes. There is no subscription, no trial that runs out, no watermark and no fee to download or send your PDF.',
  },
  {
    question: 'Can I use these as official receipts for BIR?',
    answer:
      'No. These documents are for billing, quotations and your own records. They are not BIR-registered invoices or official receipts. If your business must issue those, keep using your BIR-registered receipts or system.',
  },
  {
    question: 'Do I need to install anything?',
    answer: 'No. It runs in your browser, on a phone or a computer. Sign in with Google, or with an email and password.',
  },
  {
    question: 'Does it work without internet?',
    answer: 'You need a connection to sign in and to save. If the connection drops while you are typing, your unsaved document is kept in that browser tab so you can save it when you are back online.',
  },
  {
    question: 'Can my customer pay through the app?',
    answer: 'No. The app does not handle money. It prints your payment details (GCash, Maya, bank account) on the document so the customer can pay you directly.',
  },
  {
    question: 'How do I get the PDF?',
    answer: 'Press “Save & get PDF” and the file is saved to your Downloads. To print instead, press the printer button beside Save. On a phone, Email then “Share with PDF” attaches it to Gmail, Messenger or Viber.',
  },
  {
    question: 'I made a mistake on a saved document. Can I fix it?',
    answer: 'Yes. Open it from My documents, change it and save again. You can also make a copy of an old document to reuse its items.',
  },
  {
    question: 'I forgot my password.',
    answer: 'On the sign-in page press “Forgot password?”. We email you a link to set a new one. If you signed up with Google, just use “Continue with Google”.',
  },
  {
    question: 'How do I move or erase my data?',
    answer: 'In My business you can download a backup of everything at any time, restore it later, or delete your account. Deleting erases your documents and business details right away and cannot be undone.',
  },
];

/** The full About page. Shown inside the app and, signed out, from the sign-in screen. */
export function AboutPage({ callToAction }: AboutPageProps) {
  return (
    <article className="about">
      <header className="about-hero">
        <p className="eyebrow">About Libreng Invoice</p>
        <h1 className="about-title">
          Invoices, quotations and receipts for small businesses. <mark>Libre.</mark>
        </h1>
        <p className="about-lead">
          Libreng Invoice is a free tool for sari-sari stores, online sellers, small shops and freelancers in the
          Philippines. Type what you sold, and get a clean document with your name, your prices and your payment
          details, ready to print or send.
        </p>
        <div className="about-cta">{callToAction}</div>
        <dl className="about-facts">
          <div>
            <dt>Price</dt>
            <dd>₱0</dd>
          </div>
          <div>
            <dt>Document types</dt>
            <dd>{DOCUMENT_KINDS.length}</dd>
          </div>
          <div>
            <dt>Currencies</dt>
            <dd>{CURRENCIES.length}</dd>
          </div>
          <div>
            <dt>Ads</dt>
            <dd>None</dd>
          </div>
        </dl>
      </header>

      <section className="about-section" aria-labelledby="about-why">
        <p className="eyebrow">Why it exists</p>
        <h2 id="about-why">A resibo should not need a subscription</h2>
        <div className="about-prose">
          <p>
            Most invoice makers online let you fill in everything, then ask for a monthly fee before you can download
            the PDF. That is a lot to pay when all you need is a neat document to hand to a customer.
          </p>
          <p>
            This one does the simple job well: a proper-looking invoice, quotation or receipt in about a minute, saved
            to your own account so you can find it again from your phone or computer.
          </p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-documents">
        <p className="eyebrow">What you can make</p>
        <h2 id="about-documents">Four documents, one way of filling them in</h2>
        <ul className="about-documents">
          {DOCUMENT_KINDS.map((kind) => (
            <li key={kind} className="about-document">
              <span className="about-document-code">{DOCUMENT_KIND_CONFIG[kind].numberPrefix}-2026-0001</span>
              <h3>{DOCUMENT_KIND_CONFIG[kind].title}</h3>
              <p>
                <strong>Use it when:</strong> {DOCUMENT_GUIDE[kind].when}
              </p>
              <p>
                <strong>On the page:</strong> {DOCUMENT_GUIDE[kind].includes}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-section" aria-labelledby="about-steps">
        <p className="eyebrow">How it works</p>
        <h2 id="about-steps">From blank to sent in four steps</h2>
        <ol className="about-steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="about-section" aria-labelledby="about-features">
        <p className="eyebrow">What it can do</p>
        <h2 id="about-features">Built around how small shops really sell</h2>
        <ul className="about-features">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-section" aria-labelledby="about-data">
        <p className="eyebrow">Your data</p>
        <h2 id="about-data">What we keep, who can see it, and how to remove it</h2>
        <dl className="about-ledger">
          <div>
            <dt>What is saved</dt>
            <dd>
              Your business details (name, address, logo, payment options, email message) and the documents you save,
              including the customer name, address and contact you typed on them.
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>In a cloud database tied to your account, so the same documents open on your phone and your computer.</dd>
          </div>
          <div>
            <dt>Who can see it</dt>
            <dd>
              Only you. The database itself checks every request and only returns the rows that belong to the account
              that is signed in. Someone who is not signed in gets nothing.
            </dd>
          </div>
          <div>
            <dt>Passwords</dt>
            <dd>
              Handled by the sign-in service and stored scrambled (hashed). Nobody can read them, including us. With
              Google sign-in we never receive your Google password at all.
            </dd>
          </div>
          <div>
            <dt>Payments</dt>
            <dd>The app never handles money and never asks for card details. Customers pay you directly.</dd>
          </div>
          <div>
            <dt>Emails you send</dt>
            <dd>
              Sent from your own email app or Gmail. The message and the PDF are made on your device; we do not send,
              receive or keep a copy.
            </dd>
          </div>
          <div>
            <dt>Error notes</dt>
            <dd>
              When something fails we keep a short technical note for 90 days: what failed, the page, and your browser
              type. It never includes your documents, customers or passwords.
            </dd>
          </div>
          <div>
            <dt>Ads and selling data</dt>
            <dd>No ads. Your data is not sold or shared for marketing.</dd>
          </div>
          <div>
            <dt>Taking it with you</dt>
            <dd>Download a backup of everything from My business whenever you like, and restore it later.</dd>
          </div>
          <div>
            <dt>Erasing it</dt>
            <dd>Delete your account in My business. Your documents and business details are erased right away.</dd>
          </div>
        </dl>
      </section>

      <section className="about-section" aria-labelledby="about-limits">
        <p className="eyebrow">Good to know</p>
        <h2 id="about-limits">Limits</h2>
        <ul className="about-limits">
          <li>
            <strong>{MAX_LINE_ITEMS} items</strong> on one document.
          </li>
          <li>
            <strong>10,000 documents</strong> per account.
          </li>
          <li>
            <strong>Logo up to {MAX_LOGO_FILE_BYTES / 1024} KB</strong>, as a PNG, JPEG or WebP image.
          </li>
          <li>
            <strong>Amounts up to ₱9,999,999,999.99</strong> per document.
          </li>
          <li>
            <strong>An internet connection</strong> is needed to sign in and save.
          </li>
        </ul>
      </section>

      <section className="about-notice" aria-labelledby="about-bir">
        <p className="about-notice-stamp" aria-hidden="true">
          Paalala
        </p>
        <div>
          <h2 id="about-bir">These are not BIR official receipts</h2>
          <p>
            Documents made here are <strong>not BIR-registered invoices or official receipts</strong>. They are useful
            for billing, quotations and record keeping. If your business is VAT-registered or is required to issue
            official receipts, use your BIR-registered receipts or system for that. By default each document prints
            “This document is not an official receipt.”
          </p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-faq">
        <p className="eyebrow">Questions</p>
        <h2 id="about-faq">Things people ask</h2>
        <div className="about-faq">
          {FAQ.map((entry) => (
            <details key={entry.question}>
              <summary>{entry.question}</summary>
              <p>{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="about-closing">
        <h2>Ready when you are.</h2>
        <div className="about-cta">{callToAction}</div>
      </footer>
    </article>
  );
}
