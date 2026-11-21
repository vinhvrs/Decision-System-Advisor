import type { ReactNode } from "react";

export default function DataTable({ title, columns, rows, note, empty = "No matching records from this source." }: {
  title: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  note?: string;
  empty?: string;
}) {
  return <section className="nt-panel">
    <div className="nt-panel-title"><strong>{title}</strong></div>
    <div className="nt-table-wrap"><table className="nt-table">
      <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index}>{cell ?? "—"}</td>)}</tr>)
        : <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody>
    </table></div>
    {note && <div className="nt-database-note">{note}</div>}
  </section>;
}
