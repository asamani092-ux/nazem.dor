import type { ReactNode } from 'react';
import { Card } from './Card';

export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>{head}</thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  );
}
