import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button, DataSurface } from './ui';

export interface StatisticsColumn<Row> {
  id: string;
  label: string;
  sortValue: (row: Row) => string | number | null;
  render: (row: Row) => ReactNode;
  numeric?: boolean;
  className?: string;
}

export interface StatisticsTableProps<Row extends { id: string }> {
  caption: string;
  rows: Row[];
  columns: StatisticsColumn<Row>[];
  initialSort: { columnId: string; direction: 'asc' | 'desc' };
  emptyLabel: string;
  showMoreLabel: string;
  initialLimit?: number;
  minWidthClass?: string;
}

export function StatisticsTable<Row extends { id: string }>({ caption, rows, columns, initialSort, emptyLabel, showMoreLabel, initialLimit = 10, minWidthClass = 'min-w-[42rem]' }: StatisticsTableProps<Row>) {
  const [sort, setSort] = useState(initialSort);
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => {
    const column = columns.find(item => item.id === sort.columnId) ?? columns[0];
    if (!column) return rows;
    return [...rows].sort((left, right) => {
      const a = column.sortValue(left);
      const b = column.sortValue(right);
      if (a === null) return b === null ? left.id.localeCompare(right.id) : 1;
      if (b === null) return -1;
      const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
      return (sort.direction === 'asc' ? comparison : -comparison) || left.id.localeCompare(right.id);
    });
  }, [columns, rows, sort]);
  const visible = expanded ? sorted : sorted.slice(0, initialLimit);
  const changeSort = (columnId: string) => setSort(current => ({ columnId, direction: current.columnId === columnId && current.direction === 'desc' ? 'asc' : 'desc' }));

  return <DataSurface>
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-left text-sm ${minWidthClass}`}>
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-[#2a2c31] bg-[#151619] font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          <tr>{columns.map(column => {
            const active = column.id === sort.columnId;
            return <th key={column.id} scope="col" aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} className={column.className}>
              <button type="button" onClick={() => changeSort(column.id)} className="flex min-h-11 w-full items-center gap-1 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white">
                {column.label}{active && (sort.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
              </button>
            </th>;
          })}</tr>
        </thead>
        <tbody className="divide-y divide-[#2a2c31]">
          {visible.map(row => <tr key={row.id} className="text-neutral-300">{columns.map(column => <td key={column.id} className={`px-3 py-3 ${column.numeric ? 'whitespace-nowrap font-mono text-right' : ''} ${column.className ?? ''}`}>{column.render(row)}</td>)}</tr>)}
          {!visible.length && <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-neutral-500">{emptyLabel}</td></tr>}
        </tbody>
      </table>
    </div>
    {!expanded && sorted.length > initialLimit && <div className="border-t border-[#2a2c31] p-3 text-center"><Button type="button" variant="quiet" onClick={() => setExpanded(true)}>{showMoreLabel}</Button></div>}
  </DataSurface>;
}
