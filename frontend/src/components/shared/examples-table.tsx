import type { CSSProperties } from "react";
import { MiniAudio } from "@/components/shared/mini-audio";

export type ExampleCell =
  | { kind: "text"; text: string }
  | { kind: "audio"; src: string; label: string; durationLabel?: string };

export interface ExampleColumn {
  label: string;
  width?: string;
  mono?: boolean;
}

export interface ExamplesTableProps {
  title?: string;
  columns: ExampleColumn[];
  rows: ExampleCell[][];
}

export function ExamplesTable({ title = "Examples", columns, rows }: ExamplesTableProps) {
  return (
    <div className="vsf-card">
      <div className="vsf-card__body flex flex-col gap-4">
        <span className="font-display text-xs font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary)" }}>
          {title}
        </span>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    className="px-3 pb-2.5 text-left align-bottom text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{
                      width: column.width,
                      color: "var(--text-secondary)",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontFamily: column.mono ? "var(--font-mono)" : "var(--font-display)",
                      textTransform: column.mono ? "none" : "uppercase",
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-3 py-3.5 align-top"
                      style={{
                        borderTop: rowIndex === 0 ? undefined : "1px solid var(--border-subtle)",
                        width: columns[cellIndex]?.width,
                      }}
                    >
                      {cell.kind === "audio" ? (
                        <MiniAudio src={cell.src} label={cell.label} durationLabel={cell.durationLabel} />
                      ) : (
                        <span className="leading-[1.6]" style={{ color: "var(--text-primary)", textWrap: "pretty" } as CSSProperties}>
                          {cell.text}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
