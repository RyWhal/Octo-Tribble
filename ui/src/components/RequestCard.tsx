import { useState } from 'react';
import type { WebhookRequest } from '../utils/api';
import { deleteWebhookRequest } from '../utils/api';
import { formatRelativeTime, formatLocalDate } from '../utils/time';
import HeadersTable from './HeadersTable';
import BodyViewer from './BodyViewer';

interface RequestCardProps {
  request: WebhookRequest;
  onDelete: (id: string) => void;
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  POST: 'bg-blue-900/50 text-blue-400 border-blue-800',
  PUT: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  PATCH: 'bg-orange-900/50 text-orange-400 border-orange-800',
  DELETE: 'bg-red-900/50 text-red-400 border-red-800',
};

function MethodBadge({ method }: { method: string }) {
  const style = METHOD_STYLES[method.toUpperCase()] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700';
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-mono font-semibold rounded border ${style}`}>
      {method.toUpperCase()}
    </span>
  );
}

type ActiveTab = 'headers' | 'body';

export default function RequestCard({ request, onDelete }: RequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('body');
  const [deleting, setDeleting] = useState(false);

  const headers: Record<string, string> = (() => {
    try {
      return JSON.parse(request.headers);
    } catch {
      return {};
    }
  })();

  const bodySize = new TextEncoder().encode(request.body).length;

  const handleDelete = async () => {
    if (!confirm('Delete this request?')) return;
    setDeleting(true);
    try {
      await deleteWebhookRequest(request.id);
      onDelete(request.id);
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setDeleting(false);
    }
  };

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <svg
          className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <MethodBadge method={request.method} />

        <span className="font-mono text-sm text-zinc-200 truncate flex-1">{request.path}</span>

        <span className="text-xs text-zinc-500 shrink-0">
          {request.content_type ? request.content_type.split(';')[0] : '—'}
        </span>

        <span className="text-xs text-zinc-500 shrink-0 w-20 text-right">
          {bodySize > 0 ? `${(bodySize / 1024).toFixed(1)}KB` : '—'}
        </span>

        <span className="text-xs text-zinc-500 shrink-0 w-28 text-right" title={formatLocalDate(request.received_at)}>
          {formatRelativeTime(request.received_at)}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/50">
          <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800/50">
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>From: <span className="text-zinc-400 font-mono">{request.source_ip || '—'}</span></span>
              <span>At: <span className="text-zinc-400">{formatLocalDate(request.received_at)}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2.5 py-1 text-xs rounded border border-red-900 text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pt-3 flex gap-1 border-b border-zinc-800/50">
            {(['body', 'headers'] as ActiveTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 text-sm capitalize rounded-t transition-colors ${
                  activeTab === t
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t}
                {t === 'headers' && (
                  <span className="ml-1.5 text-xs text-zinc-500">
                    {Object.keys(headers).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-4">
            {activeTab === 'body' && (
              <BodyViewer body={request.body} contentType={request.content_type} />
            )}
            {activeTab === 'headers' && (
              <HeadersTable headers={headers} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
