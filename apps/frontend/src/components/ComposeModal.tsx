'use client';

import React, { useEffect, useRef, useState } from 'react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ComposeModalProps {
  onClose: () => void;
  onRefresh: () => void;
}

interface SenderAccount {
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
}

export default function ComposeModal({ onClose, onRefresh }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('100');
  const [scheduledAt, setScheduledAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [senderAccount, setSenderAccount] = useState<SenderAccount | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`${apiBaseUrl}/api/emails/sender-account`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(typeof result.error === 'string' ? result.error : 'Could not check the sending account.');
        }
        if (!active) return;

        const account = result.account as SenderAccount | null;
        setSenderAccount(account);
        if (!account) {
          setShowAccountForm(true);
        } else {
          setAccountEmail(account.email);
          setSmtpHost(account.smtpHost);
          setSmtpPort(String(account.smtpPort));
          setSmtpUser(account.smtpUser);
        }
      })
      .catch((requestError) => {
        if (active) {
          console.error('Could not load the sending account:', requestError);
          setError(requestError instanceof Error ? requestError.message : 'Could not check the sending account.');
        }
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });

    return () => { active = false; };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result;
      if (typeof text !== 'string') return;
      const lines = text.split(/\r?\n/);
      const matches = lines.filter((line) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line.trim()));
      setDetectedCount(matches.length > 0 ? matches.length : lines.length);
    };
    reader.readAsText(selectedFile);
  };

  const handleAccountSubmission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSavingAccount(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/emails/sender-account`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: accountEmail,
          host: smtpHost,
          port: smtpPort,
          username: smtpUser,
          password: smtpPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Could not connect the sending account.');
      }

      setSenderAccount(result.account as SenderAccount);
      setSmtpPassword('');
      setShowAccountForm(false);
    } catch (saveError) {
      console.error('Could not connect the sending account:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not connect the sending account.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleFormSubmission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !subject || !body || !scheduledAt) return;

    setSubmitting(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('delaySeconds', delaySeconds);
    formData.append('hourlyLimit', hourlyLimit);
    formData.append('scheduledAt', new Date(scheduledAt).toISOString());

    try {
      const response = await fetch(`${apiBaseUrl}/api/emails/schedule`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : `Could not schedule messages (${response.status}).`);
      }

      onRefresh();
      onClose();
    } catch (submitError) {
      console.error('Could not schedule the campaign:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Could not schedule messages.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClassName = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white p-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {showAccountForm ? 'Connect a sending account' : 'Compose campaign'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {showAccountForm
                ? 'Add an SMTP account to send your scheduled messages.'
                : 'Prepare and schedule messages for your recipients.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close compose window" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        {accountLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">Checking your sending account…</div>
        ) : showAccountForm ? (
          <form onSubmit={handleAccountSubmission} className="space-y-5 p-6">
            {!senderAccount && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                You need to connect an email provider before scheduling a campaign. Use SMTP settings from your email provider. For Gmail, use an app password, not your Google account password.
              </p>
            )}
            {senderAccount && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Updating sender <span className="font-medium text-slate-800">{senderAccount.email}</span>. Enter the SMTP password again to verify and save the changes.
              </p>
            )}

            <label className="block text-sm font-medium text-slate-700">
              Sender email
              <input type="email" autoComplete="email" required maxLength={254} value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} className={inputClassName} placeholder="you@example.com" />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-slate-700">
                SMTP host
                <input type="text" required maxLength={255} value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} className={inputClassName} placeholder="smtp.example.com" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                SMTP port
                <input type="number" required min={1} max={65535} value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} className={inputClassName} />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              SMTP username
              <input type="text" autoComplete="username" required maxLength={254} value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} className={inputClassName} placeholder="Usually your full email address" />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              SMTP password or app password
              <input type="password" autoComplete="new-password" required maxLength={512} value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} className={inputClassName} />
            </label>

            {error && <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              {senderAccount && (
                <button type="button" onClick={() => { setShowAccountForm(false); setError(''); }} disabled={savingAccount} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={savingAccount} className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
                {savingAccount ? 'Verifying SMTP…' : 'Verify and connect'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleFormSubmission} className="space-y-6 p-6">
            {senderAccount && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                <p className="text-xs text-slate-600">Sending from <span className="font-medium text-slate-800">{senderAccount.email}</span></p>
                <button type="button" onClick={() => { setShowAccountForm(true); setError(''); }} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">Change</button>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="campaign-subject" className="text-xs font-semibold text-slate-500">Subject</label>
              <input id="campaign-subject" type="text" required value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none" placeholder="Subject line" />
            </div>

            <div className="space-y-2">
              <label htmlFor="campaign-body" className="text-xs font-semibold text-slate-500">Message</label>
              <textarea id="campaign-body" rows={5} required value={body} onChange={(event) => setBody(event.target.value)} className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none" placeholder="Write your message..." />
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div className="space-y-2">
                <label htmlFor="campaign-delay" className="text-xs font-semibold text-slate-500">Delay (sec)</label>
                <input id="campaign-delay" type="number" min="1" value={delaySeconds} onChange={(event) => setDelaySeconds(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-sm font-medium text-slate-700 focus:border-emerald-400 focus:outline-none" />
              </div>
              <div className="space-y-2">
                <label htmlFor="campaign-limit" className="text-xs font-semibold text-slate-500">Hourly limit</label>
                <input id="campaign-limit" type="number" min="1" value={hourlyLimit} onChange={(event) => setHourlyLimit(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-sm font-medium text-slate-700 focus:border-emerald-400 focus:outline-none" />
              </div>
              <div className="space-y-2">
                <label htmlFor="campaign-schedule" className="text-xs font-semibold text-slate-500">Schedule for</label>
                <input id="campaign-schedule" type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>

            <div className="group relative rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50/40">
              <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileChange} required className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full space-y-2">
                <span aria-hidden="true" className="text-2xl text-slate-400 group-hover:text-emerald-600">📋</span>
                <span className="block text-sm font-medium text-slate-700">{file ? file.name : 'Choose a recipients file'}</span>
                <span className="block text-xs text-slate-400">Upload a CSV or TXT file with one email address per line.</span>
              </button>
              {detectedCount !== null && (
                <div className="mt-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700">
                  {detectedCount} recipients found
                </div>
              )}
            </div>

            {error && <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <div className="flex justify-end space-x-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={submitting || !file} className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-40">
                {submitting ? 'Scheduling…' : 'Schedule messages'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
