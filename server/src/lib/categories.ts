export const categoryValues = ["billing", "technical", "account", "refund"] as const;

export type Category = (typeof categoryValues)[number];
