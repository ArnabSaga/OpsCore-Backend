import { InvoiceStatus } from "../../../generated/prisma/enums";

export interface IInvoiceItemPayload {
  description: string;
  quantity: number;
  unitPrice: string;
}

export interface ICreateInvoicePayload {
  customerName?: string;
  customerEmail?: string;
  currency?: string;
  notes?: string;
  dueAt?: string | null;
  items: IInvoiceItemPayload[];
}

export interface IUpdateInvoicePayload {
  customerName?: string | null;
  customerEmail?: string | null;
  currency?: string;
  notes?: string | null;
  dueAt?: string | null;
  items?: IInvoiceItemPayload[];
}

export interface IInvoiceQuery {
  searchTerm?: string;
  status?: InvoiceStatus;
  overdue?: "true" | "false";
  issued?: "true" | "false";
  page?: string;
  limit?: string;
  sortBy?: "createdAt" | "updatedAt" | "dueAt" | "amount" | "invoiceNumber" | "status";
  sortOrder?: "asc" | "desc";
}

export interface IInvoiceActionFlags {
  canEdit: boolean;
  canDelete: boolean;
  canSend: boolean;
  canMarkPaid: boolean;
  canCancel: boolean;
  canPreviewPdf: boolean;
}

export interface IInvoiceBase {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  isOverdue: boolean;
  customerName: string | null;
  customerEmail: string | null;
  notes: string | null;
  issuedAt: Date | null;
  sentAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  actions: IInvoiceActionFlags;
  createdByUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface IInvoiceListItem extends IInvoiceBase {
  _count: {
    items: number;
  };
}

export interface IInvoiceItemResponse {
  id: string;
  workspaceId: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  createdAt: Date;
}

export interface IInvoiceResponse extends IInvoiceBase {
  items: IInvoiceItemResponse[];
}

