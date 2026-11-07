'use client';

import React, { useState, useEffect } from 'react';
import { apiBaseUrl } from '@/lib/config';

export default function IntegrationBar() {
  const [connected, setConnected] = useState(false);
  const [channelName, setChannelName] = useState<string | null>(null);

  const verifyConnectionStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/slack/status`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Could not check Slack status (${res.status}).`);
      const data = await res.json();
      setConnected(data.connected);
      setChannelName(data.channelName);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    verifyConnectionStatus();
    // Establish tracking polling boundary to catch closing popup contexts cleanly
    const interval = setInterval(verifyConnectionStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSlackIntegrationLink = () => {
    if (connected) return;
    window.open(`${apiBaseUrl}/api/slack/connect`, 'Slack Authorization', 'width=600,height=700');
  };

  const handleDisconnectAction = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/slack/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) { setConnected(false); setChannelName(null); }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-850 p-5 rounded-2xl border border-slate-700/80 shadow-xl flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="text-2xl p-2.5 bg-slate-900 rounded-xl border border-slate-700">🔒</div>
        <div>
          <h3 className="font-bold text-slate-100 flex items-center">
            Distributed Throttling Slack Warning Interceptor
            {connected && <span className="ml-3 px-2 py-0.5 text-[10px] tracking-wider uppercase font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md">Operational</span>}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Stream target system threshold saturation warnings straight into active project groups.</p>
        </div>
      </div>

      {connected ? (
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-xs text-slate-400">Target Channel Context</p>
            <p className="text-sm font-mono text-indigo-400 font-bold">{channelName || '#general-logs'}</p>
          </div>
          <button onClick={handleDisconnectAction} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold transition-all">
            Sever Pipeline
          </button>
        </div>
      ) : (
        <button onClick={handleSlackIntegrationLink} className="px-5 py-2.5 bg-[#4A154B] hover:bg-[#5C1D5E] text-white rounded-xl text-xs font-bold shadow-lg shadow-black/20 flex items-center space-x-2 transition-all group">
          <span>Connect Slack Pipeline</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </button>
      )}
    </div>
  );
}
