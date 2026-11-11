import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AboutContent } from './about/AboutContent';
import { SettingsPage } from './business/SettingsPage';
import type { BusinessProfile } from './business/types';
import { toLocalDateString } from './dates/dates';
import { describeError } from './errors/reportError';
import { DOCUMENT_KIND_CONFIG } from './invoices/documentKinds';
import { DocumentEditor } from './invoices/DocumentEditor';
import { DocumentHistory } from './invoices/DocumentHistory';
import { createNewDraft, draftFromDocument, duplicateAsDraft, type DocumentDraft } from './invoices/draft';
import { computeTotals } from './invoices/totals';
import type { BusinessDocument, DocumentKind, Party } from './invoices/types';
import { deleteDocument, loadAppData, saveDocument, saveProfile, type AppData } from './storage/database';
import { setThemePreference, useTheme } from './theme/theme';
import { IconCreate, IconDocuments, IconInfo, IconMoon, IconPlus, IconSettings, IconSignOut, IconSun } from './ui/icons';
import { useConfirm } from './ui/useConfirm';

interface WorkspaceProps {
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
export function Workspace({ userEmail, onSignOut }: WorkspaceProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [view, setView] = useState<View>('editor');
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  /** True once the user edits the draft; cleared when it is saved or replaced. */
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const { resolved: resolvedTheme } = useTheme();

  const applyLoadedData = useCallback((data: AppData) => {
    setLoadState({ status: 'ready', data });
    setDraft(
      (current) =>
        current ?? createNewDraft({ kind: 'invoice', today: today(), counters: data.counters, profile: data.profile, createId }),
    );
  }, []);

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

  const updateData = (changes: Partial<AppData>) => setLoadState({ status: 'ready', data: { ...data, ...changes } });

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
  };

  const persistDocument = async (doc: BusinessDocument) => {
    const { document: saved, counters } = await saveDocument(doc);
    const documents = [...data.documents.filter((other) => other.id !== saved.id), saved];
    updateData({ documents, counters });
    return saved;
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
    replaceDraft(draftFromDocument(await persistDocument(doc)));
  };

  const handleMarkPaid = async (doc: BusinessDocument) => {
    const paidDoc = { ...doc, amountPaidCentavos: computeTotals(doc).total, updatedAt: now().toISOString() };
    const saved = await persistDocument(paidDoc);
    if (draft.id === doc.id && !hasUnsavedChanges) replaceDraft(draftFromDocument(saved));
  };

  const handleDelete = async (doc: BusinessDocument) => {
    await deleteDocument(doc);
    updateData({ documents: data.documents.filter((other) => other.id !== doc.id) });
    if (draft.id === doc.id) {
      replaceDraft(createNewDraft({ kind: doc.kind, today: today(), counters: data.counters, profile: data.profile, createId }));
    }
  };

  const handleSaveProfile = async (profile: BusinessProfile) => {
    await saveProfile(profile);
    updateData({ profile });
  };

  const handleSignOut = async () => {
    if (await confirmDiscardChanges()) onSignOut();
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
              createId={createId}
              now={now}
            />
          </>
        )}
        {view === 'history' && (
          <DocumentHistory
            documents={data.documents}
            onOpen={async (doc) => {
              if (draft.id !== doc.id) {
                if (!(await confirmDiscardChanges())) return;
                replaceDraft(draftFromDocument(doc));
              }
              setView('editor');
            }}
            onDuplicate={async (doc) => {
              if (!(await confirmDiscardChanges())) return;
              replaceDraft(duplicateAsDraft(doc, { today: today(), counters: data.counters, createId }));
              setView('editor');
            }}
            onMarkPaid={handleMarkPaid}
            onDelete={handleDelete}
            onCreate={goToCreate}
          />
        )}
        {view === 'settings' && (
          <SettingsPage profile={data.profile} onSaveProfile={handleSaveProfile} onDataImported={reload} createId={createId} now={now} />
        )}
        {view === 'about' && (
          <section className="card about-page" aria-labelledby="about-heading">
            <h2 id="about-heading">About Libreng Invoice</h2>
            <AboutContent />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>Free to use. Documents made here are not BIR-registered official receipts or invoices.</p>
      </footer>
      {confirmDialog}
    </div>
  );
}
