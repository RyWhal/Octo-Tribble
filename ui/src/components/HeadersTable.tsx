interface HeadersTableProps {
  headers: Record<string, string>;
}

export default function HeadersTable({ headers }: HeadersTableProps) {
  const entries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return <p className="text-zinc-500 text-sm italic">No headers</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-mono">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-zinc-800 last:border-0">
              <td className="py-1.5 pr-4 text-zinc-400 whitespace-nowrap align-top w-1/3">{key}</td>
              <td className="py-1.5 text-zinc-200 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
