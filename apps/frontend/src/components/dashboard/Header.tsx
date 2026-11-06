'use client';

import React from 'react';

interface HeaderProps {
  onSearch: (query: string) => void;
  onRefresh: () => void;
  onComposeClick: () => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
}

export default function Header({ onSearch, onRefresh, onComposeClick, onLogout, userName, userEmail }: HeaderProps) {
  const initials = userName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <header className="flex min-h-[64px] items-center gap-4 border-b border-slate-100 px-5 sm:px-7">
      <label className="relative flex w-full max-w-[560px] items-center">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" fill="none">
          <circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="m15.5 15.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search messages"
          className="h-9 w-full rounded-full bg-slate-50 pl-10 pr-4 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-slate-100 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh messages"
          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
            <path d="M20 11a8 8 0 0 0-14.8-3L4 10m0 0V5m0 5h5m-5 3a8 8 0 0 0 14.8 3L20 14m0 0v5m0-5h-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" onClick={onComposeClick} className="hidden rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-600 sm:inline-flex">
          Compose
        </button>
        <div className="hidden text-right sm:block">
          <p className="max-w-36 truncate text-[11px] font-medium text-slate-700">{userName}</p>
          <p className="max-w-36 truncate text-[10px] text-slate-400">{userEmail}</p>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-700" aria-label={`${userName} account`}>{initials}</span>
        <button type="button" onClick={onLogout} className="rounded-md px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          Sign out
        </button>
      </div>
    </header>
  );
}
