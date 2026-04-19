import { pgTable, serial, numeric, timestamp, varchar, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sensorReadingsTable = pgTable("sensor_readings", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 32 }).notNull().default("unknown"),
  temperature: numeric("temperature", { precision: 6, scale: 2 }),
  humidity: numeric("humidity", { precision: 6, scale: 2 }),
  luminosity: numeric("luminosity", { precision: 8, scale: 2 }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown> | null>(),
});

export const commandLogsTable = pgTable("command_logs", {
  id: serial("id").primaryKey(),
  command: varchar("command", { length: 32 }).notNull(),
  source: varchar("source", { length: 32 }).notNull().default("dashboard"),
  status: varchar("status", { length: 16 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSensorReadingSchema = createInsertSchema(sensorReadingsTable).omit({
  id: true,
  recordedAt: true,
});

export const selectSensorReadingSchema = createSelectSchema(sensorReadingsTable);

export const insertCommandLogSchema = createInsertSchema(commandLogsTable).omit({
  id: true,
  createdAt: true,
});

export const selectCommandLogSchema = createSelectSchema(commandLogsTable);

export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;
export type SensorReading = z.infer<typeof selectSensorReadingSchema>;

export type InsertCommandLog = z.infer<typeof insertCommandLogSchema>;
export type CommandLog = z.infer<typeof selectCommandLogSchema>;
