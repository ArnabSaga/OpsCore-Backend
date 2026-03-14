export type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELED";

interface CalculateInvoiceStatusParams {
  dueDate: Date | string;
  paidAt?: Date | string | null;
  canceledAt?: Date | string | null;
}

export const calculateInvoiceStatus = ({
  dueDate,
  paidAt,
  canceledAt,
}: CalculateInvoiceStatusParams): InvoiceStatus => {
  if (canceledAt) {
    return "CANCELED";
  }

  if (paidAt) {
    return "PAID";
  }

  const now = new Date();
  const due = new Date(dueDate);

  if (now > due) {
    return "OVERDUE";
  }

  return "PENDING";
};
