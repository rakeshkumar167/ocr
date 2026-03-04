import type { InvoiceListItem } from "../types";

interface Props {
  invoices: InvoiceListItem[];
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function InvoiceHistory({ invoices, loading, onSelect, onNew }: Props) {
  return (
    <div className="history-container">
      <div className="history-header">
        <h3>Invoice History</h3>
        <button className="reset-btn" onClick={onNew}>New Invoice</button>
      </div>
      {loading && (
        <div className="history-loading">
          <div className="spinner" />
        </div>
      )}
      {!loading && invoices.length === 0 && (
        <p className="history-empty">No invoices yet. Upload one to get started.</p>
      )}
      {!loading && invoices.length > 0 && (
        <div className="history-list">
          {invoices.map((inv) => (
            <button key={inv.id} className="history-item" onClick={() => onSelect(inv.id)}>
              <span className="history-date">
                {inv.invoice_date
                  ? `Invoice: ${inv.invoice_date}`
                  : new Date(inv.created_at).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    })}
              </span>
              <span className="history-preview">
                {inv.summaryPreview ?? "No summary"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
