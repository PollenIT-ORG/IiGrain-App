import { z } from "zod";

export const signContractSchema = z.object({
  signedName: z
    .string({ error: "Type your full name to sign." })
    .trim()
    .min(2, "Please type your full name.")
    .max(150, "Name is too long."),
  // Data URL of a drawn signature, uploaded server side. Optional when typed.
  signatureImage: z.string().max(2_000_000).optional().nullable(),
  accepted: z.literal(true, {
    error: "You must accept the contract to sign it.",
  }),
});

export const contractTokenParamSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32,64}$/i, "This contract link is not valid."),
});

export type SignContractBody = z.infer<typeof signContractSchema>;
