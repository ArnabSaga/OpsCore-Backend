import PDFDocument from "pdfkit";
import { Invoice, Prisma } from "../../../generated/prisma/client";
import { InvoiceStatus } from "../../../generated/prisma/enums";
import { calculateInvoiceStatus } from "../../utils/calculateInvoiceStatus";
import { IInvoiceActionFlags, IInvoiceBase, IInvoiceResponse } from "./invoice.interface";

export interface InvoiceEmailItem {
  description: string;
  quantity: number;
  amount: string;
  subtext?: string;
}

export interface InvoiceEmailTemplateData {
  subject: string;
  invoiceNumber: string;
  currency: string;
  totalAmount: string;
  subtotal: string;
  status: string;
  customerName: string;
  customerEmail?: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceEmailItem[];
  actionUrl?: string;
  actionText?: string;
  supportEmail?: string;
  year: number;
  appName: string;
}

export const formatMoney = (value: Prisma.Decimal | string | number) => {
  return new Prisma.Decimal(value).toFixed(2);
};

export const formatInvoiceDate = (date: Date | null) => {
  if (!date) return "N/A";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

export const mapInvoiceToEmailTemplateData = (
  invoice: IInvoiceResponse,
  options?: {
    subject?: string;
    actionUrl?: string;
    actionText?: string;
    supportEmail?: string;
    appName?: string;
  }
): InvoiceEmailTemplateData => {
  return {
    subject: options?.subject ?? `Invoice ${invoice.invoiceNumber} from OpsCore`,
    invoiceNumber: invoice.invoiceNumber,
    currency: invoice.currency,
    totalAmount: invoice.amount,
    subtotal: invoice.amount,
    status: invoice.status,
    customerName: invoice.customerName ?? "Customer",
    customerEmail: invoice.customerEmail ?? undefined,
    issueDate: formatInvoiceDate(invoice.issuedAt ?? invoice.createdAt),
    dueDate: formatInvoiceDate(invoice.dueAt),
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      amount: item.lineTotal,
      subtext: `${invoice.currency}${item.unitPrice} each`,
    })),
    actionUrl: options?.actionUrl,
    actionText: options?.actionText ?? "View Invoice",
    supportEmail: options?.supportEmail,
    year: new Date().getFullYear(),
    appName: options?.appName ?? "OpsCore",
  };
};

export const deriveInvoiceState = (
  invoice: Pick<Invoice, "dueAt" | "paidAt" | "canceledAt">
): { liveStatus: InvoiceStatus; isOverdue: boolean; actions: IInvoiceActionFlags } => {
  const liveStatus = calculateInvoiceStatus({
    dueDate: invoice.dueAt,
    paidAt: invoice.paidAt,
    canceledAt: invoice.canceledAt,
  }) as InvoiceStatus;

  const isOverdue = liveStatus === "OVERDUE";

  const actions: IInvoiceActionFlags = {
    canEdit: liveStatus === "PENDING" || liveStatus === "OVERDUE",
    canDelete: liveStatus === "PENDING" || liveStatus === "CANCELED",
    canSend: liveStatus !== "CANCELED",
    canMarkPaid: liveStatus !== "CANCELED" && liveStatus !== "PAID",
    canCancel: liveStatus !== "PAID" && liveStatus !== "CANCELED",
    canPreviewPdf: true,
  };

  return { liveStatus, isOverdue, actions };
};

export type PrismaInvoicePayload = Prisma.InvoiceGetPayload<{
  include: {
    createdByUser: {
      select: {
        id: true;
        name: true;
        email: true;
        image: true;
      };
    };
  };
}>;

export const mapInvoiceBase = (invoice: PrismaInvoicePayload): IInvoiceBase => {
  const { liveStatus, isOverdue, actions } = deriveInvoiceState(invoice);

  return {
    id: invoice.id,
    workspaceId: invoice.workspaceId,
    createdByUserId: invoice.createdByUserId,
    invoiceNumber: invoice.invoiceNumber,
    amount: formatMoney(invoice.amount),
    currency: invoice.currency,
    status: liveStatus,
    isOverdue,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    notes: invoice.notes,
    issuedAt: invoice.issuedAt,
    sentAt: invoice.sentAt,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
    canceledAt: invoice.canceledAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    actions,
    createdByUser: {
      id: invoice.createdByUser.id,
      name: invoice.createdByUser.name,
      email: invoice.createdByUser.email,
      image: invoice.createdByUser.image,
    },
  };
};

const ensurePageSpace = (doc: typeof PDFDocument, requiredHeight = 80) => {
  const bottomY = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight > bottomY) {
    doc.addPage();
  }
};

const drawLabelValue = (doc: typeof PDFDocument, label: string, value: string, x: number, y: number) => {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(label, x, y);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(value, x, y + 14);
};

export const generateInvoicePdf = async (invoice: IInvoiceResponse): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", (error) => {
        reject(error);
      });

      // Header
      doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text("INVOICE", 50, 50, {
        align: "left",
      });

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#7C3AED")
        .text("OpsCore", 400, 54, { align: "right" });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6B7280")
        .text("Multi-Tenant Workspace & Operations Platform", 300, 76, {
          align: "right",
          width: 245,
        });

      doc.moveTo(50, 100).lineTo(545, 100).strokeColor("#E5E7EB").stroke();

      // Invoice metadata
      let sectionY = 120;

      drawLabelValue(doc, "Invoice Number", invoice.invoiceNumber, 50, sectionY);
      drawLabelValue(doc, "Status", invoice.status, 220, sectionY);
      drawLabelValue(
        doc,
        "Issue Date",
        formatInvoiceDate(invoice.issuedAt ?? invoice.createdAt),
        380,
        sectionY
      );

      sectionY += 52;

      drawLabelValue(doc, "Billed To", invoice.customerName ?? "Customer", 50, sectionY);
      drawLabelValue(doc, "Customer Email", invoice.customerEmail ?? "N/A", 220, sectionY);
      drawLabelValue(doc, "Due Date", formatInvoiceDate(invoice.dueAt), 380, sectionY);

      sectionY += 62;

      // Table header
      doc.moveTo(50, sectionY).lineTo(545, sectionY).strokeColor("#E5E7EB").stroke();
      sectionY += 12;

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151");
      doc.text("Description", 50, sectionY);
      doc.text("Qty", 340, sectionY, { width: 50, align: "right" });
      doc.text("Unit Price", 395, sectionY, { width: 70, align: "right" });
      doc.text("Amount", 470, sectionY, { width: 75, align: "right" });

      sectionY += 18;
      doc.moveTo(50, sectionY).lineTo(545, sectionY).strokeColor("#E5E7EB").stroke();
      sectionY += 10;

      // Items
      doc.font("Helvetica").fontSize(10).fillColor("#111827");

      for (const item of invoice.items) {
        ensurePageSpace(doc, 48);

        const currentY = doc.y > sectionY ? doc.y : sectionY;

        const descriptionHeight = doc.heightOfString(item.description, {
          width: 270,
        });

        doc.text(item.description, 50, currentY, {
          width: 270,
        });

        doc.text(String(item.quantity), 340, currentY, {
          width: 50,
          align: "right",
        });

        doc.text(`${invoice.currency}${item.unitPrice}`, 395, currentY, {
          width: 70,
          align: "right",
        });

        doc.text(`${invoice.currency}${item.lineTotal}`, 470, currentY, {
          width: 75,
          align: "right",
        });

        const rowHeight = Math.max(descriptionHeight, 18);
        const rowBottomY = currentY + rowHeight + 8;

        doc.moveTo(50, rowBottomY).lineTo(545, rowBottomY).strokeColor("#F3F4F6").stroke();
        doc.y = rowBottomY + 8;
      }

      ensurePageSpace(doc, 130);

      // Summary
      const summaryTop = doc.y + 8;

      doc.font("Helvetica").fontSize(10).fillColor("#6B7280");
      doc.text("Subtotal", 395, summaryTop, { width: 70, align: "right" });
      doc.text(`${invoice.currency}${invoice.amount}`, 470, summaryTop, {
        width: 75,
        align: "right",
      });

      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827");
      doc.text("Total", 395, summaryTop + 24, { width: 70, align: "right" });
      doc.text(`${invoice.currency}${invoice.amount}`, 470, summaryTop + 24, {
        width: 75,
        align: "right",
      });

      // Notes
      if (invoice.notes) {
        ensurePageSpace(doc, 90);
        doc.moveDown(3);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Notes");
        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(10).fillColor("#4B5563").text(invoice.notes, {
          width: 495,
        });
      }

      // Footer
      ensurePageSpace(doc, 80);
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#E5E7EB").stroke();
      doc.moveDown(0.8);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6B7280")
        .text("This is a system-generated invoice from OpsCore.", 50, doc.y, {
          align: "center",
          width: 495,
        });

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6B7280")
        .text("For billing questions, please contact support.", 50, doc.y + 4, {
          align: "center",
          width: 495,
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

