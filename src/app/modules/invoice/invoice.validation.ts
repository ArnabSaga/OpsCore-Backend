import { z } from "zod";

const invoiceIdParamSchema = z.object({
  params: z.object({
    invoiceId: z.string().uuid("Invoice ID must be a valid UUID"),
  }),
});

const invoiceItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Item description is required")
    .max(500, "Item description cannot exceed 500 characters"),
  quantity: z.coerce
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(100000, "Quantity is too large"),
  unitPrice: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal with up to 2 decimal places"),
});

const createInvoiceSchema = z.object({
  body: z.object({
    customerName: z
      .string()
      .trim()
      .min(2, "Customer name must be at least 2 characters")
      .max(150, "Customer name cannot exceed 150 characters")
      .optional(),
    customerEmail: z.string().trim().toLowerCase().email("Invalid customer email").optional(),
    currency: z
      .string()
      .trim()
      .min(3, "Currency must be at least 3 characters")
      .max(10, "Currency cannot exceed 10 characters")
      .optional(),
    notes: z.string().trim().max(5000, "Notes cannot exceed 5000 characters").optional(),
    dueAt: z.string().datetime().nullable().optional(),
    items: z.array(invoiceItemSchema).min(1, "At least one invoice item is required").max(100),
  }),
});

const updateInvoiceSchema = z.object({
  body: z
    .object({
      customerName: z
        .string()
        .trim()
        .min(2, "Customer name must be at least 2 characters")
        .max(150, "Customer name cannot exceed 150 characters")
        .nullable()
        .optional(),
      customerEmail: z
        .union([z.string().trim().toLowerCase().email("Invalid customer email"), z.null()])
        .optional(),
      currency: z
        .string()
        .trim()
        .min(3, "Currency must be at least 3 characters")
        .max(10, "Currency cannot exceed 10 characters")
        .optional(),
      notes: z
        .string()
        .trim()
        .max(5000, "Notes cannot exceed 5000 characters")
        .nullable()
        .optional(),
      dueAt: z.string().datetime().nullable().optional(),
      items: z.array(invoiceItemSchema).min(1).max(100).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

const getInvoicesQuerySchema = z.object({
  query: z.object({
    searchTerm: z.string().trim().optional(),
    status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
    overdue: z.enum(["true", "false"]).optional(),
    issued: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "dueAt", "amount", "invoiceNumber", "status"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

const getPlatformInvoicesQuerySchema = z.object({
  query: z.object({
    searchTerm: z.string().trim().optional(),
    status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED"]).optional(),
    workspaceId: z.string().uuid("Workspace ID must be a valid UUID").optional(),
    overdue: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z
      .enum([
        "createdAt",
        "updatedAt",
        "dueAt",
        "amount",
        "invoiceNumber",
        "status",
        "workspaceName",
      ])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const InvoiceValidation = {
  invoiceIdParamSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  getInvoicesQuerySchema,
  getPlatformInvoicesQuerySchema,
};

