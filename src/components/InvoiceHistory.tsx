import type { InvoiceListItem } from "../types";

interface Props {
  invoices: InvoiceListItem[];
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDashboard: () => void;
}

export function InvoiceHistory({ invoices, loading, onSelect }: Props) {
  return (
    <div className="history-container">
      {loading && (
        <div className="history-loading">
          <div className="spinner" />
        </div>
      )}
      {!loading && invoices.length === 0 && (
        <p className="history-empty">No invoices yet. Upload one to get started.</p>
      )}
      {!loading && invoices.length > 0 && (
        <div className="invoice-table-scroll">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="amount-col">Amount</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} onClick={() => onSelect(inv.id)} className="invoice-row">
                  <td className="date-cell">
                    {inv.invoice_date
                      ? inv.invoice_date
                      : new Date(inv.created_at).toLocaleDateString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                  </td>
                  <td className="desc-cell">
                    {inv.invoice_description ?? inv.summaryPreview ?? "No description"}
                  </td>
                  <td className="amount-cell">
                    {inv.invoice_amount != null
                      ? `$${inv.invoice_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="category-cell">
                    {inv.invoice_category ? (
                      <span className="category-badge">{inv.invoice_category}</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
