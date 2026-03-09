import { useState } from 'react';
import CopyButton from './CopyButton';

interface BodyViewerProps {
  body: string;
  contentType: string;
}

function tryParseJson(text: string): { ok: true; pretty: string } | { ok: false } {
  try {
    const parsed = JSON.parse(text);
    return { ok: true, pretty: JSON.stringify(parsed, null, 2) };
  } catch {
    return { ok: false };
  }
}

function parseFormEncoded(text: string): Array<[string, string]> {
  const safeDecode = (value: string): string => {
    try {
      return decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      return value;
    }
  };

  return text
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) return [safeDecode(pair), ''] as [string, string];
      return [
        safeDecode(pair.slice(0, idx)),
        safeDecode(pair.slice(idx + 1)),
      ] as [string, string];
    });
}

type RenderTab = 'formatted' | 'raw';

export default function BodyViewer({ body, contentType }: BodyViewerProps) {
  const [tab, setTab] = useState<RenderTab>('formatted');
  const [expanded, setExpanded] = useState(true);

  if (!body) {
    return <p className="text-zinc-500 text-sm italic">No body</p>;
  }

  const baseType = contentType.split(';')[0].trim().toLowerCase();
  const isJson = baseType === 'application/json' || baseType.endsWith('+json');
  const isFormEncoded = baseType === 'application/x-www-form-urlencoded';
  const isText = baseType.startsWith('text/');

  const jsonResult = isJson ? tryParseJson(body) : null;
  const parsedJson = isJson && jsonResult?.ok ? JSON.parse(body) : null;
  const formPairs = isFormEncoded ? parseFormEncoded(body) : null;

  const renderFormatted = () => {
    if (isJson && jsonResult?.ok) {
      return (
        <JsonNode value={parsedJson} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      );
    }
    if (isFormEncoded && formPairs) {
      return (
        <table className="w-full text-sm font-mono">
          <tbody>
            {formPairs.map(([key, value], i) => (
              <tr key={i} className="border-b border-zinc-800 last:border-0">
                <td className="py-1.5 pr-4 text-zinc-400 whitespace-nowrap align-top w-1/3">{key}</td>
                <td className="py-1.5 text-zinc-200 break-all">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (isText || !contentType) {
      return (
        <pre className="text-sm font-mono text-zinc-200 whitespace-pre-wrap break-all">{body}</pre>
      );
    }
    return (
      <div>
        <p className="text-xs text-zinc-500 mb-2">
          Content-Type: <span className="text-zinc-400">{contentType}</span> — showing raw text
        </p>
        <pre className="text-sm font-mono text-zinc-200 whitespace-pre-wrap break-all">{body}</pre>
      </div>
    );
  };

  const hasFormattedView = isJson || isFormEncoded || isText || !contentType;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {hasFormattedView && (
            <button
              onClick={() => setTab('formatted')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                tab === 'formatted'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Formatted
            </button>
          )}
          <button
            onClick={() => setTab('raw')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              tab === 'raw'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Raw
          </button>
        </div>
        <CopyButton text={body} label="Copy body" />
      </div>

      <div className="bg-zinc-950 rounded border border-zinc-800 p-3 overflow-x-auto max-h-96 overflow-y-auto">
        {tab === 'formatted' ? renderFormatted() : (
          <pre className="text-sm font-mono text-zinc-200 whitespace-pre-wrap break-all">{body}</pre>
        )}
      </div>
    </div>
  );
}

// Recursive JSON renderer with expand/collapse
function JsonNode({
  value,
  expanded,
  onToggle,
  depth = 0,
}: {
  value: unknown;
  expanded: boolean;
  onToggle?: () => void;
  depth?: number;
}) {
  const [localExpanded, setLocalExpanded] = useState(true);
  const isTopLevel = depth === 0;
  const isOpen = isTopLevel ? expanded : localExpanded;

  if (value === null) return <span className="text-zinc-500">null</span>;
  if (typeof value === 'boolean') return <span className="text-purple-400">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-blue-400">{value}</span>;
  if (typeof value === 'string') return <span className="text-emerald-400">"{value}"</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-400">[]</span>;
    return (
      <span>
        <button
          onClick={isTopLevel ? onToggle : () => setLocalExpanded(!localExpanded)}
          className="text-zinc-400 hover:text-zinc-200 text-xs"
        >
          {isOpen ? '▾' : '▸'}
        </button>
        {' ['}
        {isOpen ? (
          <span>
            <br />
            {value.map((item, i) => (
              <span key={i}>
                <span style={{ paddingLeft: `${(depth + 1) * 16}px` }} className="inline-block">
                  <JsonNode value={item} expanded depth={depth + 1} />
                  {i < value.length - 1 && <span className="text-zinc-600">,</span>}
                </span>
                <br />
              </span>
            ))}
            <span style={{ paddingLeft: `${depth * 16}px` }} className="inline-block">]</span>
          </span>
        ) : (
          <span className="text-zinc-500"> … {value.length} items ]</span>
        )}
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-zinc-400">{'{}'}</span>;
    return (
      <span>
        <button
          onClick={isTopLevel ? onToggle : () => setLocalExpanded(!localExpanded)}
          className="text-zinc-400 hover:text-zinc-200 text-xs"
        >
          {isOpen ? '▾' : '▸'}
        </button>
        {' {'}
        {isOpen ? (
          <span>
            <br />
            {entries.map(([key, val], i) => (
              <span key={key}>
                <span style={{ paddingLeft: `${(depth + 1) * 16}px` }} className="inline-block">
                  <span className="text-zinc-300">"{key}"</span>
                  <span className="text-zinc-600">: </span>
                  <JsonNode value={val} expanded depth={depth + 1} />
                  {i < entries.length - 1 && <span className="text-zinc-600">,</span>}
                </span>
                <br />
              </span>
            ))}
            <span style={{ paddingLeft: `${depth * 16}px` }} className="inline-block">{'}'}</span>
          </span>
        ) : (
          <span className="text-zinc-500"> … {entries.length} keys {'}'}</span>
        )}
      </span>
    );
  }

  return <span className="text-zinc-400">{String(value)}</span>;
}
