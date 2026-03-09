import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Endpoint, WebhookRequest } from '../utils/api';
import { listEndpoints, listRequests, clearRequests, ingestUrl } from '../utils/api';
import { formatLocalDate, formatTimeRemaining, isExpired } from '../utils/time';
import CopyButton from '../components/CopyButton';
import RequestCard from '../components/RequestCard';

export default function EndpointDetail() {
  const { id } = useParams<{ id: string }>();
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [clearing, setClearing] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const loadRequests = useCallback(async () => {
    if (!id) return;
    try {
      const data = await listRequests(id);
      setRequests(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    }
  }, [id]);

  const loadEndpoint = useCallback(async () => {
    if (!id) return;
    try {
      const allEndpoints = await listEndpoints();
      const ep = allEndpoints.find((e) => e.id === id);
      if (!ep) {
        setError('Endpoint not found');
      } else {
        setEndpoint(ep);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load endpoint');
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadEndpoint(), loadRequests()]);
      setLoading(false);
    };
    init();
  }, [loadEndpoint, loadRequests]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        loadRequests();
        loadEndpoint();
      }, 5000);
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loadRequests, loadEndpoint]);

  const handleClearAll = async () => {
    if (!id) return;
    if (!confirm('Delete all captured requests for this endpoint?')) return;
    setClearing(true);
    try {
      await clearRequests(id);
      setRequests([]);
      if (endpoint) {
        setEndpoint({ ...endpoint, request_count: 0 });
      }
    } catch (err) {
      alert(`Failed to clear: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteRequest = (requestId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    if (endpoint) {
      setEndpoint({ ...endpoint, request_count: Math.max(0, endpoint.request_count - 1) });
    }
  };

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

  if (error && !endpoint) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All endpoints
        </Link>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const url = id ? ingestUrl(id) : '';
  const expired = endpoint ? isExpired(endpoint.expires_at) : false;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 mb-6 w-fit">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All endpoints
      </Link>

      {/* Endpoint header */}
      {endpoint && (
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-100">
                {endpoint.name ?? <span className="text-zinc-400 italic">Unnamed</span>}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-sm font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
                  {url}
                </code>
                <CopyButton text={url} />
              </div>
            </div>
            {expired && (
              <span className="shrink-0 px-2.5 py-1 text-xs rounded border border-red-900 text-red-500 bg-red-900/20">
                Expired
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-zinc-500">
            <span>Created: <span className="text-zinc-400">{formatLocalDate(endpoint.created_at)}</span></span>
            <span>
              Expires: <span className={expired ? 'text-red-500' : 'text-zinc-400'}>
                {formatLocalDate(endpoint.expires_at)}
                {!expired && <span className="text-zinc-600 ml-1">({formatTimeRemaining(endpoint.expires_at)})</span>}
              </span>
            </span>
            <span>Requests: <span className="text-zinc-400">{endpoint.request_count}</span></span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-900/40 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-zinc-300">
          Captured Requests
          {requests.length > 0 && (
            <span className="ml-2 text-zinc-500 text-sm font-normal">({requests.length})</span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-400">
            <div
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                autoRefresh ? 'bg-indigo-600' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  autoRefresh ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            Auto-refresh
          </label>
          {requests.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-900 transition-colors disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          )}
          <button
            onClick={loadRequests}
            className="px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Request list */}
      {requests.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 mx-auto mb-4 animate-pulse-subtle" />
          <p className="text-zinc-400 font-medium mb-1">Waiting for requests…</p>
          <p className="text-zinc-600 text-sm">
            Send a request to <code className="font-mono text-zinc-500">{url}</code>
          </p>
          {!autoRefresh && (
            <button
              onClick={() => setAutoRefresh(true)}
              className="mt-4 px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Enable auto-refresh
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <RequestCard key={req.id} request={req} onDelete={handleDeleteRequest} />
          ))}
        </div>
      )}
    </div>
  );
}
