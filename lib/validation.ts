import { z } from "zod";

const reference = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, and hyphens only.");
const amountCents = z.number().int().positive();
const split = z.object({ richard: z.number().int().min(0).max(100), anastasia: z.number().int().min(0).max(100), "jean-claude": z.number().int().min(0).max(100) });

export const saleInput = z.object({
  type: z.literal("sale"), reference, actor: z.enum(["richard", "anastasia", "jean-claude"]), customer: z.string().trim().min(1),
  project: z.enum(["A", "B"]), description: z.string().trim().min(1), amountCents, proposedSplit: split,
  origin: z.enum(["WEB", "TELEGRAM"]).default("WEB"), originChatId: z.string().nullable().default(null)
}).superRefine((data, ctx) => {
  if (Object.values(data.proposedSplit).reduce((a, b) => a + b, 0) !== 100) ctx.addIssue({ code: "custom", message: "Commission shares must total 100%.", path: ["proposedSplit"] });
});

export const expenseInput = z.object({
  type: z.literal("expense"), reference, actor: z.literal("kevin"), description: z.string().trim().min(1),
  category: z.enum(["MATERIALS", "TRAVEL", "OTHER"]), amountCents, proposedAllocation: z.enum(["A", "B", "OVERHEAD"]),
  origin: z.enum(["WEB", "TELEGRAM"]).default("WEB"), originChatId: z.string().nullable().default(null)
});

export const transactionInput = z.discriminatedUnion("type", [saleInput, expenseInput]);
export const saleApprovalInput = z.object({ actor: z.literal("svetlana"), split });
export const expenseApprovalInput = z.object({ actor: z.literal("svetlana"), allocation: z.enum(["A", "B", "OVERHEAD"]) });
