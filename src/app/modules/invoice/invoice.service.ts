import { Request } from "express";
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { InvoiceStatus } from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { assertPlanFeatureEnabled, assertPlanLimitNotReached } from "../../utils/checkPlanLimit";
import {
  ICreateInvoicePayload,
  IInvoiceListItem,
  IInvoiceQuery,
  IInvoiceResponse,
  IUpdateInvoicePayload,
} from "./invoice.interface";

const isDbConnectionError = (error: unknown) => {
  const prismaError = error as { code?: string };
  return prismaError?.code === "P1001" || prismaError?.code === "P1002";
};

const toMoneyString = (value: Prisma.Decimal | number | string) => {
  return new Prisma.Decimal(value).toFixed(2);
};

const normalizeCurrency = (currency?: string) => {
  return (currency?.trim().toUpperCase() || "USD").slice(0, 10);
};

const generateInvoiceNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${random}`;
};

const buildInvoiceItems = (workspaceId: string, items: ICreateInvoicePayload["items"]) => {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const lineTotal = unitPrice.mul(quantity);

    return {
      workspaceId,
      description: item.description.trim(),
      quantity,
      unitPrice,
      lineTotal,
    };
  });
};

const calculateInvoiceAmount = (
  items: Array<{
    quantity: number;
    unitPrice: Prisma.Decimal;
  }>
) => {
  return items.reduce(
    (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0)
  );
};

const getInvoiceSelect = {
  id: true,
  workspaceId: true,
  createdByUserId: true,
  invoiceNumber: true,
  amount: true,
  currency: true,
  status: true,
  customerName: true,
  customerEmail: true,
  notes: true,
  issuedAt: true,
  sentAt: true,
  dueAt: true,
  paidAt: true,
  canceledAt: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  items: {
    where: {},
    select: {
      id: true,
      workspaceId: true,
      invoiceId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} as const;

const getScopedInvoiceOrThrow = async (invoiceId: string, workspaceId: string) => {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      workspaceId,
      deletedAt: null,
      workspace: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      workspaceId: true,
      invoiceNumber: true,
      status: true,
      issuedAt: true,
      sentAt: true,
      paidAt: true,
      dueAt: true,
      canceledAt: true,
      customerEmail: true,
      deletedAt: true,
    },
  });

  if (!invoice) {
    throw new AppError(status.NOT_FOUND, "Invoice not found");
  }

  return invoice;
};

const mapInvoiceResponse = (invoice: any): IInvoiceResponse => {
  return {
    id: invoice.id,
    workspaceId: invoice.workspaceId,
    createdByUserId: invoice.createdByUserId,
    invoiceNumber: invoice.invoiceNumber,
    amount: toMoneyString(invoice.amount),
    currency: invoice.currency,
    status: invoice.status,
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
    createdByUser: {
      id: invoice.createdByUser.id,
      name: invoice.createdByUser.name,
      email: invoice.createdByUser.email,
      image: invoice.createdByUser.image,
    },
    items: invoice.items.map((item: any) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      invoiceId: item.invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: toMoneyString(item.unitPrice),
      lineTotal: toMoneyString(item.lineTotal),
      createdAt: item.createdAt,
    })),
  };
};

const getInvoices = async (
  req: Request
): Promise<{
  data: IInvoiceListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  try {
    const workspaceId = req.workspaceId!;
    const query = req.query as unknown as IInvoiceQuery;

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const where: Prisma.InvoiceWhereInput = {
      workspaceId,
      deletedAt: null,
      workspace: {
        deletedAt: null,
      },
    };

    const andConditions: Prisma.InvoiceWhereInput[] = [];

    if (query.searchTerm) {
      andConditions.push({
        OR: [
          { invoiceNumber: { contains: query.searchTerm, mode: "insensitive" } },
          { customerName: { contains: query.searchTerm, mode: "insensitive" } },
          { customerEmail: { contains: query.searchTerm, mode: "insensitive" } },
          { notes: { contains: query.searchTerm, mode: "insensitive" } },
        ],
      });
    }

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.issued === "true") {
      andConditions.push({ issuedAt: { not: null } });
    }

    if (query.issued === "false") {
      andConditions.push({ issuedAt: null });
    }

    if (query.overdue === "true") {
      andConditions.push({
        dueAt: { lt: new Date() },
        status: { not: InvoiceStatus.PAID },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          workspaceId: true,
          createdByUserId: true,
          invoiceNumber: true,
          amount: true,
          currency: true,
          status: true,
          customerName: true,
          customerEmail: true,
          notes: true,
          issuedAt: true,
          sentAt: true,
          dueAt: true,
          paidAt: true,
          canceledAt: true,
          createdAt: true,
          updatedAt: true,
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((invoice) => ({
        id: invoice.id,
        workspaceId: invoice.workspaceId,
        createdByUserId: invoice.createdByUserId,
        invoiceNumber: invoice.invoiceNumber,
        amount: toMoneyString(invoice.amount),
        currency: invoice.currency,
        status: invoice.status,
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
        createdByUser: {
          id: invoice.createdByUser.id,
          name: invoice.createdByUser.name,
          email: invoice.createdByUser.email,
          image: invoice.createdByUser.image,
        },
        _count: {
          items: invoice._count.items,
        },
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch invoices");
  }
};

const createInvoice = async (req: Request): Promise<IInvoiceResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const createdByUserId = req.user!.id;
    const payload = req.body as ICreateInvoicePayload;

    await assertPlanFeatureEnabled(workspaceId, "invoices.create");
    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "monthlyInvoices",
      incrementBy: 1,
      customMessage: 'You have reached the "monthlyInvoices" limit for your current plan.',
    });

    const builtItems = buildInvoiceItems(workspaceId, payload.items);
    const amount = calculateInvoiceAmount(builtItems);

    let attempts = 0;

    while (attempts < 3) {
      try {
        const invoice = await prisma.$transaction(async (tx) => {
          const created = await tx.invoice.create({
            data: {
              workspaceId,
              createdByUserId,
              invoiceNumber: generateInvoiceNumber(),
              amount,
              currency: normalizeCurrency(payload.currency),
              status: InvoiceStatus.PENDING,
              customerName: payload.customerName?.trim() || null,
              customerEmail: payload.customerEmail?.trim().toLowerCase() || null,
              notes: payload.notes?.trim() || null,
              dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
              items: {
                create: builtItems,
              },
            },
            select: getInvoiceSelect,
          });

          return created;
        });

        return mapInvoiceResponse(invoice);
      } catch (error: any) {
        if (error?.code === "P2002") {
          attempts += 1;
          continue;
        }
        throw error;
      }
    }

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to generate a unique invoice number");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create invoice");
  }
};

const getInvoice = async (req: Request): Promise<IInvoiceResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const invoiceId = req.params.invoiceId as string;

    await getScopedInvoiceOrThrow(invoiceId, workspaceId);

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        workspaceId,
        deletedAt: null,
        workspace: {
          deletedAt: null,
        },
      },
      select: getInvoiceSelect,
    });

    if (!invoice) {
      throw new AppError(status.NOT_FOUND, "Invoice not found");
    }

    return mapInvoiceResponse(invoice);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch invoice");
  }
};

const updateInvoice = async (req: Request): Promise<IInvoiceResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const invoiceId = req.params.invoiceId as string;
    const payload = req.body as IUpdateInvoicePayload;

    const existingInvoice = await getScopedInvoiceOrThrow(invoiceId, workspaceId);

    if (existingInvoice.status === InvoiceStatus.PAID) {
      throw new AppError(status.BAD_REQUEST, "Paid invoices cannot be updated");
    }

    if (existingInvoice.status === InvoiceStatus.CANCELED) {
      throw new AppError(status.BAD_REQUEST, "Canceled invoices cannot be updated");
    }

    let rebuiltItems:
      | Array<{
          workspaceId: string;
          description: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
          lineTotal: Prisma.Decimal;
        }>
      | undefined;

    let nextAmount: Prisma.Decimal | undefined;

    if (payload.items) {
      rebuiltItems = buildInvoiceItems(workspaceId, payload.items);
      nextAmount = calculateInvoiceAmount(rebuiltItems);
    }

    const invoice = await prisma.$transaction(async (tx) => {
      if (rebuiltItems) {
        await tx.invoiceItem.deleteMany({
          where: {
            invoiceId,
            workspaceId,
          },
        });
      }

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          ...(payload.customerName !== undefined && {
            customerName: payload.customerName === null ? null : payload.customerName.trim(),
          }),
          ...(payload.customerEmail !== undefined && {
            customerEmail:
              payload.customerEmail === null ? null : payload.customerEmail.trim().toLowerCase(),
          }),
          ...(payload.currency !== undefined && {
            currency: normalizeCurrency(payload.currency),
          }),
          ...(payload.notes !== undefined && {
            notes: payload.notes === null ? null : payload.notes.trim(),
          }),
          ...(payload.dueAt !== undefined && {
            dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
          }),
          ...(nextAmount !== undefined && {
            amount: nextAmount,
          }),
          ...(rebuiltItems
            ? {
                items: {
                  create: rebuiltItems,
                },
              }
            : {}),
        },
        select: getInvoiceSelect,
      });

      return updated;
    });

    return mapInvoiceResponse(invoice);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update invoice");
  }
};

const deleteInvoice = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const invoiceId = req.params.invoiceId as string;

    const existingInvoice = await getScopedInvoiceOrThrow(invoiceId, workspaceId);

    if (
      existingInvoice.status !== InvoiceStatus.PENDING &&
      existingInvoice.status !== InvoiceStatus.CANCELED
    ) {
      throw new AppError(status.BAD_REQUEST, "Only pending or canceled invoices can be deleted");
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        deletedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete invoice");
  }
};

const sendInvoice = async (req: Request): Promise<IInvoiceResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const invoiceId = req.params.invoiceId as string;

    await assertPlanFeatureEnabled(workspaceId, "invoices.send");

    const existingInvoice = await getScopedInvoiceOrThrow(invoiceId, workspaceId);

    if (existingInvoice.status === InvoiceStatus.CANCELED) {
      throw new AppError(status.BAD_REQUEST, "Canceled invoices cannot be sent");
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(existingInvoice.issuedAt === null ? { issuedAt: new Date() } : {}),
        sentAt: new Date(),
      },
      select: getInvoiceSelect,
    });

    return mapInvoiceResponse(invoice);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to send invoice");
  }
};

const markInvoicePaid = async (req: Request): Promise<IInvoiceResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const invoiceId = req.params.invoiceId as string;

    const existingInvoice = await getScopedInvoiceOrThrow(invoiceId, workspaceId);

    if (existingInvoice.status === InvoiceStatus.CANCELED) {
      throw new AppError(status.BAD_REQUEST, "Canceled invoices cannot be marked as paid");
    }

    if (existingInvoice.status === InvoiceStatus.PAID) {
      throw new AppError(status.BAD_REQUEST, "Invoice is already paid");
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        ...(existingInvoice.issuedAt === null ? { issuedAt: new Date() } : {}),
      },
      select: getInvoiceSelect,
    });

    return mapInvoiceResponse(invoice);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to mark invoice as paid");
  }
};

const cancelInvoice = async (req: Request): Promise<IInvoiceResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const invoiceId = req.params.invoiceId as string;

    const existingInvoice = await getScopedInvoiceOrThrow(invoiceId, workspaceId);

    if (existingInvoice.status === InvoiceStatus.PAID) {
      throw new AppError(status.BAD_REQUEST, "Paid invoices cannot be canceled");
    }

    if (existingInvoice.status === InvoiceStatus.CANCELED) {
      throw new AppError(status.BAD_REQUEST, "Invoice is already canceled");
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.CANCELED,
        canceledAt: new Date(),
      },
      select: getInvoiceSelect,
    });

    return mapInvoiceResponse(invoice);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to cancel invoice");
  }
};

export const InvoiceService = {
  getInvoices,
  createInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  markInvoicePaid,
  cancelInvoice,
};
