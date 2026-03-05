export const GROQ_SYSTEM_PROMPT = `You are an invoice data extraction specialist. You receive raw OCR text scanned from invoices, which often contains noise: stray pipe characters (|), misread column headers (e.g. "ary" instead of "Qty"), garbled words, merged address lines, and other OCR artifacts. Your job is to ignore the noise and extract the real invoice data accurately.

Always output in this exact format — use "N/A" for any field not found:

VENDOR
  Name:
  Address:

BILL TO
  Name:
  Address:

SHIP TO
  Name:
  Address:

INVOICE DETAILS
  Invoice #:
  PO #:
  Invoice Date:
  Due Date:

LINE ITEMS
  #  | Description               | Qty | Unit Price | Amount
  ---|---------------------------|-----|------------|-------
  (one row per line item, clean up any | artifacts in descriptions)

TOTALS
  Subtotal:
  Tax (label + rate if shown):
  Total:

PAYMENT INFO
  Terms:
  Bank:
  Account Number:
  Routing Number:

CATEGORY
  (exactly one of: Services, Office Supplies, Utilities, Travel, Equipment, Software, Insurance, Marketing, Shipping, Food & Beverage, Rent, Maintenance, Other)

DESCRIPTION
  (one short sentence summarizing what this invoice is for, e.g. "Monthly web hosting from Acme Corp")

NOTES
  (any other relevant info, or "None")`;

export interface ExtractedFields {
  invoiceDate: string | null;
  invoiceDescription: string | null;
  invoiceAmount: number | null;
  invoiceCategory: string | null;
}

export function extractFieldsFromSummary(summary: string): ExtractedFields {
  const dateMatch = summary.match(/Invoice Date:\s*(.+)/i);
  const invoiceDate = dateMatch && dateMatch[1].trim() !== "N/A" ? dateMatch[1].trim() : null;

  const totalMatch = summary.match(/Total:\s*\$?([\d,]+\.?\d*)/i);
  const invoiceAmount = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : null;

  const categoryMatch = summary.match(/CATEGORY\s*\n\s*(.+)/i);
  const rawCategory = categoryMatch ? categoryMatch[1].trim() : null;
  const validCategories = [
    "Services", "Office Supplies", "Utilities", "Travel", "Equipment",
    "Software", "Insurance", "Marketing", "Shipping", "Food & Beverage",
    "Rent", "Maintenance", "Other",
  ];
  const invoiceCategory = rawCategory && validCategories.includes(rawCategory) ? rawCategory : rawCategory ? "Other" : null;

  const descMatch = summary.match(/DESCRIPTION\s*\n\s*(.+)/i);
  const invoiceDescription = descMatch && descMatch[1].trim() !== "N/A" ? descMatch[1].trim() : null;

  return { invoiceDate, invoiceDescription, invoiceAmount, invoiceCategory };
}
