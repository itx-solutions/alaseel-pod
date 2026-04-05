import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Starter table — adjust or replace as the PoD domain evolves. */
export const example = pgTable("example", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
