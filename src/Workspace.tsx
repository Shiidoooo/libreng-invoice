import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AboutPage } from './about/AboutPage';
import { SettingsPage } from './business/SettingsPage';
import type { BusinessProfile } from './business/types';
import { toLocalDateString } from './dates/dates';
import { AppError } from './errors/appError';
import { describeError } from './errors/reportError';
import { DOCUMENT_KIND_CONFIG } from './invoices/documentKinds';
import { DocumentEditor } from './invoices/DocumentEditor';
import { DocumentHistory } from './invoices/DocumentHistory';
import { createNewDraft, draftFromDocument, duplicateAsDraft, type DocumentDraft } from './invoices/draft';
import { clearUnsavedDraft, storeUnsavedDraft, takeUnsavedDraft } from './invoices/draftStorage';
import { isAutomaticNumber, suggestNextNumber } from './invoices/numbering';
import type { BusinessDocument, DocumentKind, Party } from './invoices/types';
import { centavosToPlainText } from './money/money';
import {
  DuplicateNumberError,
  deleteDocument,
  loadAppData,
  loadCounters,
  saveDocument,
  setDocumentAmountPaid,
  saveProfile,
  type AppData,
} from './storage/database';
import { setThemePreference, useTheme } from './theme/theme';
import { IconCreate, IconDocuments, IconInfo, IconMoon, IconPlus, IconSettings, IconSignOut, IconSun } from './ui/icons';
import { useConfirm } from './ui/useConfirm';

interface WorkspaceProps {
  userId: string;
  userEmail: string;
  onSignOut: () => void;
}

type View = 'editor' | 'history' | 'settings' | 'about';

const NAV_ITEMS: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'editor', label: 'Create', icon: <IconCreate /> },
  { view: 'history', label: 'My documents', icon: <IconDocuments /> },
  { view: 'settings', label: 'My business', icon: <IconSettings /> },
  { view: 'about', label: 'About', icon: <IconInfo /> },
];

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: AppData };

const createId = () => crypto.randomUUID();
const now = () => new Date();
const today = () => toLocalDateString(now());

/** Everything a signed-in user sees. Remounted per user, so no state leaks between accounts. */
export function Workspace({ userId, userEmail, onSignOut }: WorkspaceProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [view, setView] = useState<View>('editor');
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  /** True once the user edits the draft; cleared when it is saved or replaced. */
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  /** A document opened from My documents with "Email": the editor opens the email window for it. */
  const [emailRequestId, setEmailRequestId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const { resolved: resolvedTheme } = useTheme();

  const applyLoadedData = useCallback(
    (data: AppData) => {
      setLoadState({ status: 'ready', data });
      setDraft((current) => {
        if (current) return current;
        // Unsaved work from before the session ended in this tab.
        const restored = takeUnsavedDraft(userId);
        if (restored) {
          setHasUnsavedChanges(true);
          setIsDraftRestored(true);
          return restored;
        }
        return createNewDraft({ kind: 'invoice', today: today(), counters: data.counters, profile: data.profile, createId });
      });
    },
    [userId],
  );

  const applyLoadError = useCallback((error: unknown) => {
    setLoadState({ status: 'error', message: describeError(error, 'load your documents', 'Could not load your documents.') });
  }, []);

  /** Re-reads everything from the database. The current screen stays visible while it runs. */
  const reload = useCallback(() => loadAppData().then(applyLoadedData, applyLoadError), [applyLoadedData, applyLoadError]);

  useEffect(() => {
    let isCurrent = true;
    loadAppData().then(
      (data) => {
        if (!isCurrent) return;
        applyLoadedData(data);
        // First visit: start on settings so documents carry the seller's details.
        if (data.profile.name.trim() === '' && data.documents.length === 0) setView('settings');
      },
      (error: unknown) => {
        if (isCurrent) applyLoadError(error);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [applyLoadedData, applyLoadError]);

  // Warn before closing or reloading the tab with unsaved work. Browsers only allow their own wording here.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keep a copy of unsaved work in this tab, so it survives the session ending.
  useEffect(() => {
    if (hasUnsavedChanges && draft) storeUnsavedDraft(userId, draft);
    else clearUnsavedDraft(userId);
  }, [hasUnsavedChanges, draft, userId]);

  const data = loadState.status === 'ready' ? loadState.data : null;

  const pastCustomers = useMemo<Party[]>(() => {
    if (!data) return [];
    const byName = new Map<string, Party>();
    for (const doc of [...data.documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      if (doc.customer.name && !byName.has(doc.customer.name)) byName.set(doc.customer.name, doc.customer);
    }
    return [...byName.values()];
  }, [data]);

  if (loadState.status === 'loading' || (data && !draft)) {
    return (
      <p className="app-message" role="status">
        Loading your documents…
      </p>
    );
  }
  if (loadState.status === 'error' || !data || !draft) {
    const message = loadState.status === 'error' ? loadState.message : 'Could not load your documents.';
    return (
      <div className="app-message">
        <p className="banner banner-error" role="alert">
          {message}
        </p>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            setLoadState({ status: 'loading' });
            void reload();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  /**
   * Applies a change to the latest data, not the data captured when a button was
   * clicked, so overlapping actions (delete one row, mark another paid) don't undo each other.
   */
  const updateData = (change: (current: AppData) => Partial<AppData>) =>
    setLoadState((state) => (state.status === 'ready' ? { status: 'ready', data: { ...state.data, ...change(state.data) } } : state));

  /** Asks before throwing away unsaved edits. Resolves true when it is fine to continue. */
  const confirmDiscardChanges = async () =>
    !hasUnsavedChanges ||
    confirm({
      title: 'Leave without saving?',
      message: (
        <p>
          You have changes on <strong>{draft.number || 'this document'}</strong> that are not saved yet. If you leave now,
          they will be lost.
        </p>
      ),
      confirmLabel: 'Leave without saving',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    });

  const replaceDraft = (next: DocumentDraft) => {
    setDraft(next);
    setHasUnsavedChanges(false);
    setIsDraftRestored(false);
  };

  const replaceDocument = (saved: BusinessDocument) =>
    updateData((current) => ({ documents: [...current.documents.filter((other) => other.id !== saved.id), saved] }));

  /**
   * Opens a saved document. Opening the one already in the editor keeps its edits, except
   * for email, which must describe the saved version.
   */
  const openSavedDocument = async (doc: BusinessDocument, { shouldEmail }: { shouldEmail: boolean }) => {
    const isAlreadyOpen = draft.id === doc.id && !(shouldEmail && hasUnsavedChanges);
    if (!isAlreadyOpen) {
      if (!(await confirmDiscardChanges())) return;
      replaceDraft(draftFromDocument(doc));
    }
    setEmailRequestId(shouldEmail ? doc.id : null);
    setView('editor');
  };

  const startNewDocument = async (kind: DocumentKind = draft.kind) => {
    if (!(await confirmDiscardChanges())) return;
    replaceDraft(createNewDraft({ kind, today: today(), counters: data.counters, profile: data.profile, createId }));
    setView('editor');
  };

  /** From the empty documents list: continue a new document in progress rather than discarding it. */
  const goToCreate = () => {
    if (draft.isNew) setView('editor');
    else void startNewDocument('invoice');
  };

  const handleSaveFromEditor = async (doc: BusinessDocument) => {
    try {
      const { document: saved, counters } = await saveDocument(doc, { isNew: draft.isNew });
      replaceDocument(saved);
      updateData(() => ({ counters }));
      replaceDraft(draftFromDocument(saved));
      setIsDraftRestored(false);
    } catch (error) {
      if (error instanceof DuplicateNumberError && draft.isNew) {
        // Usually the suggested number was just used on another device: refresh the series.
        const counters = await loadCounters();
        updateData(() => ({ counters }));
        if (isAutomaticNumber(draft.kind, draft.number)) {
          const nextNumber = suggestNextNumber(counters, draft.kind, Number(draft.issueDate.slice(0, 4)));
          setDraft((current) => (current && current.id === doc.id ? { ...current, number: nextNumber } : current));
          throw new AppError(
            'conflict',
            `${doc.number} was already used, maybe on another device. The number is now ${nextNumber}. Press Save again.`,
            { cause: error },
          );
        }
      }
      throw error;
    }
  };

  const handleSetAmountPaid = async (doc: BusinessDocument, amountPaidCentavos: number) => {
    const saved = await setDocumentAmountPaid(doc, amountPaidCentavos);
    replaceDocument(saved);
    // Keep the open editor in step, so a later Save cannot undo the payment.
    setDraft((current) =>
      current && current.id === saved.id ? { ...current, amountPaidText: centavosToPlainText(saved.amountPaidCentavos) } : current,
    );
  };

  const handleDelete = async (doc: BusinessDocument) => {
    await deleteDocument(doc);
    updateData((current) => ({ documents: current.documents.filter((other) => other.id !== doc.id) }));
    if (draft.id === doc.id) {
      replaceDraft(createNewDraft({ kind: doc.kind, today: today(), counters: data.counters, profile: data.profile, createId }));
    }
  };

  const handleSaveProfile = async (profile: BusinessProfile) => {
    await saveProfile(profile);
    updateData(() => ({ profile }));
  };

  /** Always asks first: the sign-out button sits next to the theme button and is easy to hit. */
  const handleSignOut = async () => {
    const isConfirmed = await confirm(
      hasUnsavedChanges
        ? {
            title: 'Sign out without saving?',
            message: (
              <p>
                Your changes on <strong>{draft.number || 'this document'}</strong> are not saved yet. If you sign out now,
                they will be lost.
              </p>
            ),
            confirmLabel: 'Sign out without saving',
            cancelLabel: 'Keep editing',
            tone: 'danger',
          }
        : {
            title: 'Sign out?',
            message: (
              <p>
                You will be signed out of <strong>{userEmail}</strong> on this device. Your documents stay saved in your
                account.
              </p>
            ),
            confirmLabel: 'Sign out',
            cancelLabel: 'Stay signed in',
          },
    );
    if (!isConfirmed) return;
    clearUnsavedDraft(userId);
    onSignOut();
  };

  const isProfileMissing = data.profile.name.trim() === '';
  const editorHeading = draft.isNew ? `New ${DOCUMENT_KIND_CONFIG[draft.kind].title.toLowerCase()}` : `Editing ${draft.number}`;
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <p className="app-logo">
          <span className="app-logo-mark" aria-hidden="true">
            ₱
          </span>
          Libreng Invoice
        </p>
        <nav aria-label="Main" className="app-nav">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.view}>
                <button type="button" aria-current={view === item.view ? 'page' : undefined} onClick={() => setView(item.view)}>
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="app-account">
          <button
            type="button"
            className="icon-button"
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
            onClick={() => setThemePreference(nextTheme)}
          >
            {resolvedTheme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <span className="app-account-email" title={userEmail}>
            {userEmail}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={`Sign out of ${userEmail}`}
            title="Sign out"
            onClick={() => void handleSignOut()}
          >
            <IconSignOut />
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {data.skippedDocumentCount > 0 && (
          <p className="banner banner-error" role="alert">
            {data.skippedDocumentCount} saved document(s) could not be read and are hidden. Your other documents are fine.
          </p>
        )}

        {isDraftRestored && view === 'editor' && (
          <div className="banner banner-info setup-banner">
            <p>
              <strong>We kept your unsaved work.</strong> Your session ended before you saved {draft.number}. Check it and
              press Save.
            </p>
            <button type="button" className="button-quiet" onClick={() => setIsDraftRestored(false)}>
              OK, got it
            </button>
          </div>
        )}

        {isProfileMissing && view !== 'settings' && view !== 'about' && (
          <div className="banner banner-info setup-banner">
            <p>
              <strong>Welcome!</strong> Add your business name and payment details so they appear on your documents.
            </p>
            <button type="button" className="button-primary" onClick={() => setView('settings')}>
              Set up my business
            </button>
          </div>
        )}

        {view === 'editor' && (
          <>
            <div className="page-heading">
              <h2>{editorHeading}</h2>
              {!draft.isNew || hasUnsavedChanges ? (
                <button type="button" className="button-secondary" onClick={() => void startNewDocument()}>
                  <IconPlus /> New document
                </button>
              ) : null}
            </div>
            <DocumentEditor
              key={draft.id}
              draft={draft}
              profile={data.profile}
              counters={data.counters}
              pastCustomers={pastCustomers}
              onDraftChange={(next) => {
                setDraft(next);
                setHasUnsavedChanges(true);
              }}
              onSave={handleSaveFromEditor}
              accountEmail={userEmail}
              isEmailRequested={emailRequestId === draft.id}
              onEmailClosed={() => setEmailRequestId(null)}
              createId={createId}
              now={now}
            />
          </>
        )}
        {view === 'history' && (
          <DocumentHistory
            documents={data.documents}
            onOpen={(doc) => openSavedDocument(doc, { shouldEmail: false })}
            onEmail={(doc) => openSavedDocument(doc, { shouldEmail: true })}
            onDuplicate={async (doc) => {
              if (!(await confirmDiscardChanges())) return;
              replaceDraft(duplicateAsDraft(doc, { today: today(), counters: data.counters, createId }));
              setView('editor');
            }}
            onSetAmountPaid={handleSetAmountPaid}
            onDelete={handleDelete}
            onCreate={goToCreate}
          />
        )}
        {view === 'settings' && (
          <SettingsPage profile={data.profile} onSaveProfile={handleSaveProfile} onDataImported={reload} createId={createId} now={now} />
        )}
        {view === 'about' && (
          <AboutPage
            callToAction={
              <button type="button" className="button-primary button-large" onClick={goToCreate}>
                <IconPlus /> Make a document
              </button>
            }
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Free to use. Documents made here are not BIR-registered official receipts or invoices.</p>
      </footer>
      {confirmDialog}
    </div>
  );
}
