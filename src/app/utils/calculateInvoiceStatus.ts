import { endOfDay, isAfter } from "date-fns";

export type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELED";

interface CalculateInvoiceStatusParams {
  dueDate?: Date | string | null;
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

  if (dueDate) {
    const now = new Date();
    const due = new Date(dueDate);

    if (isAfter(now, endOfDay(due))) {
      return "OVERDUE";
    }
  }

  return "PENDING";
};

