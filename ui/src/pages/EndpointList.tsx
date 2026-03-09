import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Endpoint } from '../utils/api';
import { listEndpoints, createEndpoint, deleteEndpoint, ingestUrl } from '../utils/api';
import { formatRelativeTime, formatLocalDate, formatTimeRemaining, isExpired } from '../utils/time';
import CopyButton from '../components/CopyButton';
import CreateEndpointModal from '../components/CreateEndpointModal';

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-emerald-900 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {message}
      <button onClick={onDismiss} className="text-emerald-400 hover:text-emerald-200 ml-1">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function EndpointList() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listEndpoints();
      setEndpoints(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load endpoints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (params: { name?: string; expiry: string }) => {
    const ep = await createEndpoint(params);
    setEndpoints((prev) => [ep, ...prev]);
    const url = ingestUrl(ep.id);
    try {
      await navigator.clipboard.writeText(url);
      setToast('Endpoint created — URL copied to clipboard!');
    } catch {
      setToast('Endpoint created!');
    }
  };

  const handleDelete = async (ep: Endpoint) => {
    if (!confirm(`Delete endpoint "${ep.name ?? ep.id}"? This will also delete all captured requests.`)) return;
    setDeletingId(ep.id);
    try {
      await deleteEndpoint(ep.id);
      setEndpoints((prev) => prev.filter((e) => e.id !== ep.id));
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePurgeExpired = async () => {
    if (!confirm('Purge all expired endpoints and their requests?')) return;
    const expired = endpoints.filter((e) => isExpired(e.expires_at));
    for (const ep of expired) {
      try {
        await deleteEndpoint(ep.id);
      } catch {
        // continue
      }
    }
    setEndpoints((prev) => prev.filter((e) => !isExpired(e.expires_at)));
    setToast(`Purged ${expired.length} expired endpoint${expired.length !== 1 ? 's' : ''}`);
  };

  const activeEndpoints = endpoints.filter((e) => !isExpired(e.expires_at));
  const expiredEndpoints = endpoints.filter((e) => isExpired(e.expires_at));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Webhook Inspector</h1>
          <p className="text-sm text-zinc-500 mt-1">hooks.rjpw.space</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Endpoint
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-900/40 rounded-lg text-sm text-red-400">
          {error}
          <button onClick={load} className="ml-2 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Active endpoints */}
      {activeEndpoints.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl">
          <svg className="w-12 h-12 text-zinc-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-zinc-400 font-medium mb-1">No active endpoints</p>
          <p className="text-zinc-600 text-sm mb-4">Create one to start capturing webhook requests</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Endpoint
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Name / ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Ingest URL</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Requests</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {activeEndpoints.map((ep) => {
                const url = ingestUrl(ep.id);
                return (
                  <tr key={ep.id} className="hover:bg-zinc-900/50 transition-colors group">
                    <td className="px-4 py-3">
                      <Link
                        to={`/endpoints/${ep.id}`}
                        className="font-medium text-zinc-100 hover:text-indigo-400 transition-colors"
                      >
                        {ep.name ?? <span className="text-zinc-500 italic">Unnamed</span>}
                      </Link>
                      <div className="text-xs font-mono text-zinc-500 mt-0.5">{ep.id}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-zinc-400 truncate max-w-xs">{url}</code>
                        <CopyButton text={url} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/endpoints/${ep.id}`}
                        className="text-zinc-300 hover:text-indigo-400 transition-colors"
                      >
                        {ep.request_count}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 hidden lg:table-cell" title={formatLocalDate(ep.created_at)}>
                      {formatRelativeTime(ep.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-zinc-500" title={formatLocalDate(ep.expires_at)}>
                      {formatTimeRemaining(ep.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(ep)}
                        disabled={deletingId === ep.id}
                        className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-xs rounded border border-red-900 text-red-500 hover:bg-red-900/30 transition-all disabled:opacity-50"
                      >
                        {deletingId === ep.id ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Expired endpoints */}
      {expiredEndpoints.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowExpired(!showExpired)}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showExpired ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {expiredEndpoints.length} expired endpoint{expiredEndpoints.length !== 1 ? 's' : ''}
            </button>
            {showExpired && (
              <button
                onClick={handlePurgeExpired}
                className="text-xs text-red-500 hover:text-red-400 transition-colors border border-red-900/50 px-2.5 py-1 rounded"
              >
                Purge all expired
              </button>
            )}
          </div>

          {showExpired && (
            <div className="rounded-xl border border-zinc-800/50 overflow-hidden opacity-50">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-800/30">
                  {expiredEndpoints.map((ep) => (
                    <tr key={ep.id} className="group">
                      <td className="px-4 py-3">
                        <span className="text-zinc-400">{ep.name ?? <span className="italic">Unnamed</span>}</span>
                        <div className="text-xs font-mono text-zinc-600 mt-0.5">{ep.id}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">{ep.request_count} requests</td>
                      <td className="px-4 py-3 text-right text-xs text-red-600">
                        Expired {formatRelativeTime(ep.expires_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(ep)}
                          disabled={deletingId === ep.id}
                          className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-xs rounded border border-red-900 text-red-500 hover:bg-red-900/30 transition-all disabled:opacity-50"
                        >
                          {deletingId === ep.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <CreateEndpointModal onClose={() => setShowModal(false)} onSubmit={handleCreate} />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  );
}
