'use client';

import React from 'react';

interface SidebarProps {
  activeTab: 'scheduled' | 'sent';
  setActiveTab: (tab: 'scheduled' | 'sent') => void;
  onComposeClick: () => void;
  scheduledCount: number;
  sentCount: number;
  userName: string;
  userEmail: string;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none"><path d="m21 3-7.5 18-3.8-7.7L2 9.5 21 3Zm0 0L9.7 13.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function Sidebar({ activeTab, setActiveTab, onComposeClick, scheduledCount, sentCount, userName, userEmail }: SidebarProps) {
  const initials = userName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-100 bg-white max-sm:w-[68px]">
      <div className="px-5 pb-3 pt-5 max-sm:px-3">
        <a href="/dashboard" aria-label="ReachInbox home" className="block text-[22px] font-black leading-none tracking-[-1.5px] text-slate-900">
          ONG<span className="text-emerald-500">.</span>
        </a>
        <button type="button" className="mt-5 flex w-full items-center gap-2 rounded-full bg-slate-50 p-1.5 text-left hover:bg-slate-100 max-sm:justify-center">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">{initials}</span>
          <span className="min-w-0 flex-1 max-sm:hidden">
            <span className="block truncate text-[11px] font-semibold text-slate-700">{userName}</span>
            <span className="block truncate text-[9px] text-slate-400">{userEmail}</span>
          </span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="mr-1 h-3 w-3 text-slate-400 max-sm:hidden" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button
          type="button"
          onClick={onComposeClick}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500 py-2 text-[12px] font-medium text-emerald-600 transition hover:bg-emerald-50"
        >
          <span className="text-base leading-none">+</span><span className="max-sm:hidden">Compose</span>
        </button>
      </div>

      <nav aria-label="Mail folders" className="px-3 pt-2">
        <p className="mb-1 px-2 text-[9px] font-medium uppercase tracking-wide text-slate-400 max-sm:hidden">Core</p>
        <button
          type="button"
          onClick={() => setActiveTab('scheduled')}
          aria-current={activeTab === 'scheduled' ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${activeTab === 'scheduled' ? 'bg-emerald-50 font-medium text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <ClockIcon /><span className="flex-1 max-sm:hidden">Scheduled</span>
          <span className="text-[10px] text-slate-400 max-sm:hidden">{scheduledCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sent')}
          aria-current={activeTab === 'sent' ? 'page' : undefined}
          className={`mt-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${activeTab === 'sent' ? 'bg-emerald-50 font-medium text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <SendIcon /><span className="flex-1 max-sm:hidden">Sent</span>
          <span className="text-[10px] text-slate-400 max-sm:hidden">{sentCount}</span>
        </button>
      </nav>

      <div className="mt-auto border-t border-slate-100 p-3 max-sm:hidden">
        <a
          href="http://localhost:4000/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-[11px] text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <span aria-hidden="true">↗</span> Queue monitor
        </a>
      </div>
    </aside>
  );
}
