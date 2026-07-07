import { z } from 'zod';
export declare const DiceRollBodySchema: z.ZodObject<{
    attribute: z.ZodString;
    attrValue: z.ZodNumber;
    skillBonus: z.ZodDefault<z.ZodNumber>;
    bExp: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    bExp: number;
    attribute: string;
    attrValue: number;
    skillBonus: number;
}, {
    attribute: string;
    attrValue: number;
    bExp?: number | undefined;
    skillBonus?: number | undefined;
}>;
export declare const DiceRollResponseSchema: z.ZodObject<{
    attribute: z.ZodString;
    rolls: z.ZodArray<z.ZodNumber, "many">;
    result: z.ZodNumber;
    kind: z.ZodEnum<["best", "worst", "single"]>;
    skillBonus: z.ZodNumber;
    bExp: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    bExp: number;
    result: number;
    attribute: string;
    skillBonus: number;
    rolls: number[];
    kind: "single" | "best" | "worst";
    total: number;
}, {
    bExp: number;
    result: number;
    attribute: string;
    skillBonus: number;
    rolls: number[];
    kind: "single" | "best" | "worst";
    total: number;
}>;
export type DiceRollBody = z.infer<typeof DiceRollBodySchema>;
export type DiceRollResponse = z.infer<typeof DiceRollResponseSchema>;
//# sourceMappingURL=dice.schemas.d.ts.map