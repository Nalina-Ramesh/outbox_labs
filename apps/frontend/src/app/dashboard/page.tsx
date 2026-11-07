'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/dashboard/Header';
import Sidebar from '@/components/dashboard/Sidebar';
import ComposeModal from '@/components/ComposeModal';
import { apiBaseUrl } from '@/lib/config';

interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface EmailRecord {
  id: string;
  recipient: string;
  status: 'SCHEDULED' | 'PENDING_RETRY' | 'SENT' | 'FAILED';
  scheduledFor?: string;
  sentAt?: string | null;
  errorMessage?: string | null;
  campaign?: {
    subject?: string;
    body?: string;
  };
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 ${filled ? 'fill-amber-400 text-amber-400' : 'fill-none'}`}>
      <path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 16.77l-5.4 2.84 1.03-6.01-4.36-4.25 6.03-.88L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [error, setError] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [starredIds, setStarredIds] = useState<string[]>([]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = searchQuery
        ? `${apiBaseUrl}/api/emails/search?q=${encodeURIComponent(searchQuery)}`
        : `${apiBaseUrl}/api/emails/${activeTab}`;
      const response = await fetch(endpoint, { credentials: 'include' });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error(`Could not load messages (${response.status}).`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('The server returned an invalid message list.');
      setEmails(data as EmailRecord[]);
    } catch (requestError) {
      console.error('Failed to load email records:', requestError);
      setEmails([]);
      setError(requestError instanceof Error ? requestError.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' });
        if (!active) return;
        if (response.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!response.ok) throw new Error(`Could not verify your session (${response.status}).`);
        const result = await response.json();
        setSessionUser(result.user as SessionUser);
        setAuthenticated(true);
      } catch (sessionError) {
        console.error('Failed to verify the current session:', sessionError);
        if (active) {
          setAuthError(sessionError instanceof Error ? sessionError.message : 'Could not verify your session.');
          setAuthenticated(false);
        }
      }
    };
    void checkSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authenticated === false && !authError) {
      window.location.replace('/');
    } else if (authenticated === true) {
      void fetchRecords();
    }
  }, [authenticated, authError, fetchRecords]);

  useEffect(() => {
    if (selectedEmail) {
      const updatedEmail = emails.find((email) => email.id === selectedEmail.id);
      if (updatedEmail) setSelectedEmail(updatedEmail);
      else if (searchQuery || activeTab !== 'sent') setSelectedEmail(null);
    }
  }, [emails, selectedEmail, activeTab, searchQuery]);

  const scheduledCount = useMemo(
    () => emails.filter((email) => email.status === 'SCHEDULED' || email.status === 'PENDING_RETRY').length,
    [emails],
  );
  const sentCount = useMemo(
    () => emails.filter((email) => email.status === 'SENT' || email.status === 'FAILED').length,
    [emails],
  );

  const toggleStar = (emailId: string) => {
    setStarredIds((current) => current.includes(emailId)
      ? current.filter((id) => id !== emailId)
      : [...current, emailId]);
  };

  const subjectFor = (email: EmailRecord) => email.campaign?.subject || '(no subject)';
  const bodyFor = (email: EmailRecord) => email.campaign?.body || '';
  const activeLabel = activeTab === 'scheduled' ? 'Scheduled' : 'Sent';
  const handleLogout = async () => {
    try {
      await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (logoutError) {
      console.error('Could not end the session cleanly:', logoutError);
    } finally {
      window.location.replace('/');
    }
  };

  if (authenticated !== true) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-sm text-slate-500">
        {authError ? (
          <div role="alert" className="max-w-md rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-700">
            {authError}
            <button type="button" onClick={() => window.location.replace('/')} className="ml-2 font-semibold underline">Return to login</button>
          </div>
        ) : 'Verifying your session…'}
      </main>
    );
  }

  return (
    <div className="mail-app flex h-screen min-h-[480px] bg-white font-sans text-slate-800 antialiased">
      <Sidebar
        activeTab={activeTab}
        userName={sessionUser?.name || 'Account'}
        userEmail={sessionUser?.email || ''}
        setActiveTab={(tab) => {
          setSelectedEmail(null);
          setActiveTab(tab);
        }}
        onComposeClick={() => setIsComposeOpen(true)}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onSearch={(query) => {
            setSelectedEmail(null);
            setSearchQuery(query);
          }}
          onRefresh={() => void fetchRecords()}
          onComposeClick={() => setIsComposeOpen(true)}
          onLogout={handleLogout}
          userName={sessionUser?.name || 'Account'}
          userEmail={sessionUser?.email || ''}
        />

        <main className="min-h-0 flex-1 overflow-y-auto bg-white">
          {selectedEmail ? (
            <article className="h-full">
              <div className="flex min-h-[64px] items-center justify-between border-b border-slate-100 px-5 sm:px-8">
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  aria-label="Back to messages"
                  className="flex items-center gap-2 rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
                    <path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="hidden text-sm sm:inline">Back</span>
                </button>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => toggleStar(selectedEmail.id)} aria-label="Star message" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-500">
                    <StarIcon filled={starredIds.includes(selectedEmail.id)} />
                  </button>
                  <button type="button" onClick={() => setSelectedEmail(null)} aria-label="Archive message" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
                      <path d="M4 5h16v4H4zM6 9v10h12V9m-8 4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <span className="ml-3 text-xs text-slate-400">{formatDate(selectedEmail.sentAt || selectedEmail.scheduledFor)}</span>
                </div>
              </div>

              <div className="mx-auto max-w-4xl px-6 pb-12 pt-7 sm:px-10">
                <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
                  <h1 className="text-xl font-normal leading-7 text-slate-800 sm:text-2xl">{subjectFor(selectedEmail)}</h1>
                  <span className={`mt-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${selectedEmail.status === 'SCHEDULED' || selectedEmail.status === 'PENDING_RETRY' ? 'bg-orange-50 text-orange-700' : selectedEmail.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {selectedEmail.status === 'PENDING_RETRY' ? 'Pending retry' : selectedEmail.status.toLowerCase()}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
                    {selectedEmail.recipient.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-sm font-semibold text-slate-800">{selectedEmail.recipient}</p>
                      <p className="text-xs text-slate-400">{activeTab === 'scheduled' ? 'Scheduled for' : 'Sent'} {formatDate(selectedEmail.sentAt || selectedEmail.scheduledFor)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">to me <span className="ml-1 text-slate-400">⌄</span></p>

                    <div className="mt-6 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {bodyFor(selectedEmail) || <span className="italic text-slate-400">No message body.</span>}
                    </div>

                    {selectedEmail.errorMessage && (
                      <p className="mt-6 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        Delivery issue: {selectedEmail.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <section aria-label={`${activeLabel} messages`}>
              {error ? (
                <div role="alert" className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                  <button type="button" onClick={() => void fetchRecords()} className="ml-3 font-semibold underline">Try again</button>
                </div>
              ) : loading ? (
                <div className="flex h-52 items-center justify-center gap-3 text-sm text-slate-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                  Loading messages…
                </div>
              ) : emails.length === 0 ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none">
                      <path d="M3 6.5 12 13l9-6.5M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{searchQuery ? 'No matching messages' : `No ${activeLabel.toLowerCase()} messages`}</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                    {searchQuery ? 'Try another search term.' : 'Messages will appear here when you schedule or send a campaign.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {emails.map((email) => {
                    const starred = starredIds.includes(email.id);
                    return (
                      <div key={email.id} className="group flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-slate-50 sm:px-7">
                        <button
                          type="button"
                          aria-label={starred ? 'Unstar message' : 'Star message'}
                          onClick={() => toggleStar(email.id)}
                          className={`shrink-0 rounded p-1 transition ${starred ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                        >
                          <StarIcon filled={starred} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedEmail(email)}
                          className="flex min-w-0 flex-1 flex-col gap-1 py-3 text-left sm:flex-row sm:items-center sm:gap-0"
                        >
                          <span className="w-full shrink-0 truncate text-[13px] text-slate-700 sm:w-[170px]">
                            <span className="text-slate-400">To: </span>{email.recipient}
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${email.status === 'SCHEDULED' || email.status === 'PENDING_RETRY' ? 'bg-orange-50 text-orange-700' : email.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                              {email.status === 'PENDING_RETRY' ? 'Retry' : email.status === 'SCHEDULED' ? 'Scheduled' : email.status === 'FAILED' ? 'Failed' : 'Sent'}
                            </span>
                            <span className="shrink-0 truncate text-[13px] font-medium text-slate-700">{subjectFor(email)}</span>
                            <span className="hidden truncate text-[13px] text-slate-400 md:block">— {bodyFor(email).replace(/\s+/g, ' ')}</span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400 sm:ml-5 sm:w-[92px] sm:text-right">
                            {formatDate(email.sentAt || email.scheduledFor)}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {isComposeOpen && (
        <ComposeModal onClose={() => setIsComposeOpen(false)} onRefresh={() => void fetchRecords()} />
      )}
    </div>
  );
}
