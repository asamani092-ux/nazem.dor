import { useMemo, useState } from 'react';

export function PaginatedList<T>({
  items,
  pageSize = 15,
  renderItem,
  empty,
}: {
  items: T[];
  pageSize?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  empty?: React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pages - 1);

  const slice = useMemo(() => {
    const start = safePage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  if (!items.length) return empty ?? null;

  return (
    <div className="ds-paged-list">
      <div className="space-y-3">{slice.map((item, i) => renderItem(item, safePage * pageSize + i))}</div>
      {pages > 1 ? (
        <div className="ds-paged-nav">
          <span className="text-xs font-bold text-ios-muted">
            {items.length} نتيجة — صفحة {safePage + 1} / {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="ds-paged-btn"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              السابق
            </button>
            <button
              type="button"
              className="ds-paged-btn"
              disabled={safePage >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            >
              التالي
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
