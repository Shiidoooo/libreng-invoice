import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SettingsPage } from './business/SettingsPage';
import type { BusinessProfile } from './business/types';
import { toLocalDateString } from './dates/dates';
import { DOCUMENT_KIND_CONFIG } from './invoices/documentKinds';
import { DocumentEditor } from './invoices/DocumentEditor';
import { DocumentHistory } from './invoices/DocumentHistory';
import { createNewDraft, draftFromDocument, duplicateAsDraft, type DocumentDraft } from './invoices/draft';
import { computeTotals } from './invoices/totals';
import type { BusinessDocument, DocumentKind, Party } from './invoices/types';
import { deleteDocument, loadAppData, saveDocument, saveProfile, type AppData } from './storage/database';
import { IconCreate, IconDocuments, IconPlus, IconSettings, IconSignOut } from './ui/icons';

interface WorkspaceProps {
  userEmail: string;
  onSignOut: () => void;
}

type View = 'editor' | 'history' | 'settings';

const NAV_ITEMS: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'editor', label: 'Create', icon: <IconCreate /> },
  { view: 'history', label: 'My documents', icon: <IconDocuments /> },
  { view: 'settings', label: 'My business', icon: <IconSettings /> },
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

  const applyLoadedData = useCallback((data: AppData) => {
    setLoadState({ status: 'ready', data });
    setDraft(
      (current) =>
        current ?? createNewDraft({ kind: 'invoice', today: today(), counters: data.counters, profile: data.profile, createId }),
    );
  }, []);

  const applyLoadError = useCallback((error: unknown) => {
    setLoadState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load your data.' });
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

  // Warn before closing or reloading the tab with unsaved work.
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
    const message = loadState.status === 'error' ? loadState.message : 'Could not load your data.';
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

  /** Asks before throwing away unsaved edits. Returns true when it is fine to continue. */
  const confirmDiscardChanges = () =>
    !hasUnsavedChanges ||
    window.confirm(`You have unsaved changes on ${draft.number || 'this document'}.\n\nLeave without saving?`);

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

  const startNewDocument = (kind: DocumentKind = draft.kind) => {
    if (!confirmDiscardChanges()) return;
    replaceDraft(createNewDraft({ kind, today: today(), counters: data.counters, profile: data.profile, createId }));
    setView('editor');
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

  const handleSignOut = () => {
    if (confirmDiscardChanges()) onSignOut();
  };

  const isProfileMissing = data.profile.name.trim() === '';
  const editorHeading = draft.isNew ? `New ${DOCUMENT_KIND_CONFIG[draft.kind].title.toLowerCase()}` : `Editing ${draft.number}`;

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
          <span className="app-account-email" title={userEmail}>
            {userEmail}
          </span>
          <button type="button" className="icon-button" aria-label={`Sign out of ${userEmail}`} onClick={handleSignOut}>
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

        {isProfileMissing && view !== 'settings' && (
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
                <button type="button" className="button-secondary" onClick={() => startNewDocument()}>
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
            onOpen={(doc) => {
              if (draft.id !== doc.id && !confirmDiscardChanges()) return;
              if (draft.id !== doc.id) replaceDraft(draftFromDocument(doc));
              setView('editor');
            }}
            onDuplicate={(doc) => {
              if (!confirmDiscardChanges()) return;
              replaceDraft(duplicateAsDraft(doc, { today: today(), counters: data.counters, createId }));
              setView('editor');
            }}
            onMarkPaid={handleMarkPaid}
            onDelete={handleDelete}
            onCreate={() => startNewDocument('invoice')}
          />
        )}
        {view === 'settings' && (
          <SettingsPage profile={data.profile} onSaveProfile={handleSaveProfile} onDataImported={reload} createId={createId} now={now} />
        )}
      </main>

      <footer className="app-footer">
        <p>Free to use. Documents made here are not BIR-registered official receipts or invoices.</p>
      </footer>
    </div>
  );
}
