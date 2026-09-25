'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import type { PageTemplateId } from '@/lib/pages/presets';
import type { Page, WidgetSettings } from '@/lib/pages/types';
import { mergeWidgetSettings } from '@/lib/pages/operations';

/**
 * Client state of the universal pages: the saved pages, the page being viewed,
 * and — while editing — per-page drafts with a shared undo/redo history.
 * Layout changes stay in the draft until "Save"; resource actions (moving a
 * service, stopping a container…) are performed immediately by their widgets
 * and are deliberately not part of this history.
 */

const ACTIVE_PAGE_KEY = 'nasdash-active-tab';
const HISTORY_LIMIT = 100;

/** One undoable step; moving a widget to another page touches two pages. */
interface HistoryEntry {
  changes: { pageId: string; before: Page; after: Page }[];
}

export interface PageConflict {
  pageId: string;
  serverPage: Page;
}

export interface CreatePageOptions {
  name: string;
  icon: string;
  description?: string;
  template: PageTemplateId;
}

export interface PagesContextType {
  pages: Page[];
  loading: boolean;
  loadError: string | null;
  refreshPages: () => Promise<void>;
  activePageId: string;
  setActivePageId: (id: string) => void;

  editing: boolean;
  startEditing: () => void;
  /** Saves every draft; returns false and stays in edit mode on failure. */
  finishEditing: () => Promise<boolean>;
  cancelEditing: () => void;
  /** Displayed page: its draft while editing, otherwise the saved page. */
  getPage: (pageId: string) => Page | undefined;
  applyToPage: (pageId: string, operation: (page: Page) => Page) => void;
  /** Applies one operation to several pages as a single undoable step. */
  applyToPages: (pageIds: string[], operation: (pages: Page[]) => Page[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  conflict: PageConflict | null;
  resolveConflict: (choice: 'reload' | 'overwrite') => Promise<void>;

  /** Instance settings changed outside edit mode (e.g. the devices shown). */
  updateWidgetSettings: (pageId: string, widgetId: string, settings: WidgetSettings) => void;

  createPage: (options: CreatePageOptions) => Promise<Page>;
  duplicatePage: (pageId: string) => Promise<Page>;
  restorePage: (pageId: string) => Promise<Page>;
  deletePage: (pageId: string) => Promise<void>;
  updatePageDetails: (pageId: string, details: Partial<Pick<Page, 'name' | 'icon' | 'description'>>) => Promise<void>;
}

const PagesContext = createContext<PagesContextType | undefined>(undefined);

async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || `HTTP ${response.status}`;
}

export function PagesProvider({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useConfig();
  const isAdmin = user?.role === 'admin';
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePageId, setActivePageState] = useState<string>('dashboard');

  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Page>>({});
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<PageConflict | null>(null);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const refreshPages = useCallback(async () => {
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/pages');
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json() as { pages: Page[] };
      setPages(data.pages);
      setLoadError(null);
      setActivePageState(current => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_PAGE_KEY) : null;
        const preferred = data.pages.some(page => page.id === current) ? current : saved;
        if (preferred && data.pages.some(page => page.id === preferred)) return preferred;
        return data.pages[0]?.id ?? 'dashboard';
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void refreshPages();
  }, [authLoading, user?.username, refreshPages]);

  useEffect(() => {
    // Restore the last visited page once, before the first fetch completes.
    const saved = localStorage.getItem(ACTIVE_PAGE_KEY);
    if (saved) setActivePageState(saved);
  }, []);

  const setActivePageId = useCallback((id: string) => {
    setActivePageState(id);
    try { localStorage.setItem(ACTIVE_PAGE_KEY, id); } catch { /* private mode */ }
  }, []);

  const getPage = useCallback((pageId: string) => drafts[pageId] ?? pages.find(page => page.id === pageId), [drafts, pages]);

  const applyToPages = useCallback((pageIds: string[], operation: (pages: Page[]) => Page[]) => {
    const before = pageIds.map(pageId => draftsRef.current[pageId] ?? pagesRef.current.find(page => page.id === pageId));
    if (before.some(page => !page)) return;
    const after = operation(before as Page[]);
    const changes = pageIds
      .map((pageId, index) => ({ pageId, before: before[index] as Page, after: after[index] }))
      .filter(change => change.after && change.after !== change.before);
    if (!changes.length) return;
    // Keep the ref current so several operations in one event compose.
    const nextDrafts = { ...draftsRef.current };
    for (const change of changes) nextDrafts[change.pageId] = change.after;
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    setPast(current => [...current.slice(-(HISTORY_LIMIT - 1)), { changes }]);
    setFuture([]);
    setSaveError(null);
  }, []);

  const applyToPage = useCallback((pageId: string, operation: (page: Page) => Page) => {
    applyToPages([pageId], ([page]) => [operation(page)]);
  }, [applyToPages]);

  const pastRef = useRef(past);
  pastRef.current = past;
  const futureRef = useRef(future);
  futureRef.current = future;

  const undo = useCallback(() => {
    const entry = pastRef.current[pastRef.current.length - 1];
    if (!entry) return;
    setPast(current => current.slice(0, -1));
    setFuture(current => [entry, ...current]);
    setDrafts(current => {
      const next = { ...current };
      for (const change of entry.changes) next[change.pageId] = change.before;
      draftsRef.current = next;
      return next;
    });
  }, []);

  const redo = useCallback(() => {
    const entry = futureRef.current[0];
    if (!entry) return;
    setFuture(current => current.slice(1));
    setPast(current => [...current, entry]);
    setDrafts(current => {
      const next = { ...current };
      for (const change of entry.changes) next[change.pageId] = change.after;
      draftsRef.current = next;
      return next;
    });
  }, []);

  const resetEditState = useCallback(() => {
    setDrafts({});
    setPast([]);
    setFuture([]);
    setSaveError(null);
    setConflict(null);
  }, []);

  const startEditing = useCallback(() => {
    if (!isAdmin) return;
    resetEditState();
    setEditing(true);
  }, [isAdmin, resetEditState]);

  const cancelEditing = useCallback(() => {
    resetEditState();
    setEditing(false);
  }, [resetEditState]);

  const putPage = useCallback(async (page: Page): Promise<{ ok: true; page: Page } | { ok: false; conflict?: Page; error: string }> => {
    const response = await fetch('/api/pages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
    });
    if (response.status === 409) {
      const payload = await response.json().catch(() => null) as { error?: string; page?: Page } | null;
      return { ok: false, conflict: payload?.page, error: payload?.error || 'Conflict' };
    }
    if (!response.ok) return { ok: false, error: await readError(response) };
    return { ok: true, page: (await response.json() as { page: Page }).page };
  }, []);

  const adoptSavedPage = useCallback((saved: Page) => {
    setPages(current => current.map(page => page.id === saved.id ? saved : page));
  }, []);

  const finishEditing = useCallback(async () => {
    const pending = Object.values(draftsRef.current).filter(draft => {
      const saved = pagesRef.current.find(page => page.id === draft.id);
      return saved && JSON.stringify(saved) !== JSON.stringify(draft);
    });
    if (!pending.length) {
      resetEditState();
      setEditing(false);
      return true;
    }
    setSaving(true);
    setSaveError(null);
    try {
      for (const draft of pending) {
        const result = await putPage(draft);
        if (!result.ok) {
          if (result.conflict) setConflict({ pageId: draft.id, serverPage: result.conflict });
          setSaveError(result.error);
          return false;
        }
        adoptSavedPage(result.page);
        setDrafts(current => {
          const next = { ...current };
          delete next[draft.id];
          return next;
        });
      }
      resetEditState();
      setEditing(false);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  }, [adoptSavedPage, putPage, resetEditState]);

  const resolveConflict = useCallback(async (choice: 'reload' | 'overwrite') => {
    const current = conflict;
    if (!current) return;
    setConflict(null);
    setSaveError(null);
    adoptSavedPage(current.serverPage);
    if (choice === 'reload') {
      setDrafts(drafts => {
        const next = { ...drafts };
        delete next[current.pageId];
        return next;
      });
      const untouched = (entry: HistoryEntry) => entry.changes.every(change => change.pageId !== current.pageId);
      setPast(entries => entries.filter(untouched));
      setFuture(entries => entries.filter(untouched));
      return;
    }
    // Keep our draft but base it on the latest server revision, then retry.
    const draft = draftsRef.current[current.pageId];
    if (!draft) return;
    const next = { ...draftsRef.current, [current.pageId]: { ...draft, revision: current.serverPage.revision } };
    draftsRef.current = next;
    setDrafts(next);
    await finishEditing();
  }, [adoptSavedPage, conflict, finishEditing]);

  const settingsTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const updateWidgetSettings = useCallback((pageId: string, widgetId: string, settings: WidgetSettings) => {
    if (editing) {
      applyToPage(pageId, page => mergeWidgetSettings(page, widgetId, settings));
      return;
    }
    if (!isAdmin) return;
    // Outside edit mode the change is saved directly, like before.
    setPages(current => current.map(page => page.id === pageId ? mergeWidgetSettings(page, widgetId, settings) : page));
    clearTimeout(settingsTimers.current[pageId]);
    settingsTimers.current[pageId] = setTimeout(async () => {
      const page = pagesRef.current.find(candidate => candidate.id === pageId);
      if (!page) return;
      const result = await putPage(page).catch(() => null);
      if (result?.ok) adoptSavedPage(result.page);
      else void refreshPages();
    }, 400);
  }, [adoptSavedPage, applyToPage, editing, isAdmin, putPage, refreshPages]);

  const postAction = useCallback(async (body: Record<string, unknown>): Promise<Page> => {
    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json() as { page: Page }).page;
  }, []);

  const createPage = useCallback(async (options: CreatePageOptions) => {
    const page = await postAction({ action: 'create', ...options });
    setPages(current => [...current, page]);
    return page;
  }, [postAction]);

  const duplicatePage = useCallback(async (pageId: string) => {
    const page = await postAction({ action: 'duplicate', id: pageId });
    setPages(current => {
      const index = current.findIndex(candidate => candidate.id === pageId);
      const next = [...current];
      next.splice(index + 1, 0, page);
      return next;
    });
    return page;
  }, [postAction]);

  const restorePage = useCallback(async (pageId: string) => {
    const page = await postAction({ action: 'restore', id: pageId });
    adoptSavedPage(page);
    setDrafts(current => {
      const next = { ...current };
      delete next[pageId];
      return next;
    });
    return page;
  }, [adoptSavedPage, postAction]);

  const deletePage = useCallback(async (pageId: string) => {
    const response = await fetch(`/api/pages?id=${encodeURIComponent(pageId)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await readError(response));
    const remaining = pagesRef.current.filter(page => page.id !== pageId);
    setPages(remaining);
    setActivePageState(active => active === pageId ? (remaining[0]?.id ?? 'dashboard') : active);
  }, []);

  const updatePageDetails = useCallback(async (pageId: string, details: Partial<Pick<Page, 'name' | 'icon' | 'description'>>) => {
    const page = pagesRef.current.find(candidate => candidate.id === pageId);
    if (!page) return;
    const next: Page = { ...page, ...details };
    if (!next.description) delete next.description;
    const result = await putPage(next);
    if (!result.ok) {
      if (result.conflict) adoptSavedPage(result.conflict);
      throw new Error(result.error);
    }
    adoptSavedPage(result.page);
    // A draft of the same page keeps its layout but adopts the new details.
    setDrafts(current => current[pageId]
      ? { ...current, [pageId]: { ...current[pageId], ...details, revision: result.page.revision } }
      : current);
  }, [adoptSavedPage, putPage]);

  const dirty = useMemo(() => Object.values(drafts).some(draft => {
    const saved = pages.find(page => page.id === draft.id);
    return !saved || JSON.stringify(saved) !== JSON.stringify(draft);
  }), [drafts, pages]);

  useEffect(() => {
    if (!editing || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, editing]);

  useEffect(() => {
    if (!isAdmin && editing) cancelEditing();
  }, [cancelEditing, editing, isAdmin]);

  const value: PagesContextType = {
    pages, loading, loadError, refreshPages, activePageId, setActivePageId,
    editing, startEditing, finishEditing, cancelEditing, getPage, applyToPage, applyToPages,
    undo, redo, canUndo: past.length > 0, canRedo: future.length > 0,
    dirty, saving, saveError, conflict, resolveConflict,
    updateWidgetSettings, createPage, duplicatePage, restorePage, deletePage, updatePageDetails,
  };

  return <PagesContext.Provider value={value}>{children}</PagesContext.Provider>;
}

export function usePages(): PagesContextType {
  const context = useContext(PagesContext);
  if (!context) throw new Error('usePages must be used within a PagesProvider');
  return context;
}
