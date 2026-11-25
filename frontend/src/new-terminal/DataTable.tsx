import type { CSSProperties, ReactNode } from "react";

export default function DataTable({ title, columns, rows, note, meta, className = "", style, empty = "No matching records from this source.", ...layoutAttributes }: {
  title: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  note?: ReactNode;
  meta?: string;
  className?: string;
  style?: CSSProperties;
  empty?: string;
  "data-layout-x"?: number;
  "data-layout-y"?: number;
  "data-layout-w"?: number;
  "data-layout-h"?: number;
}) {
  return <section {...layoutAttributes} className={`nt-panel nt-data-table ${className}`.trim()} style={style} data-layout-key={`table:${title}`}>
    <div className="nt-panel-title">
      <strong>{title}</strong>
      {meta && <span className="nt-panel-meta">{meta}</span>}
    </div>
    <div className="nt-table-wrap"><table className="nt-table">
      <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index}>{cell ?? "—"}</td>)}</tr>)
        : <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody>
    </table></div>
    {note && <div className="nt-database-note">{note}</div>}
  </section>;
}
