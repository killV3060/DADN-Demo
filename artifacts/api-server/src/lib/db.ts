/**
 * Các interface dùng để lưu trữ và truy vấn dữ liệu cảm biến, lệnh điều khiển, và các log liên quan.
 * Các hàm dùng để lưu trữ dữ liệu vào cơ sở dữ liệu và truy xuất dữ liệu gần đây nhất.
 */

import { db } from "@workspace/db";
import { commandLogsTable, sensorReadingsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

export interface SensorReadingInput {
  temperature: number | null;
  humidity: number | null;
  luminosity: number | null;
  timestamp?: string | null;
  source: string;
  rawPayload?: Record<string, unknown> | null;
}

export interface CommandLogInput {
  command: string;
  source: "dashboard" | "mqtt" | "serial";
  status: "accepted" | "published" | "failed";
  detail?: string;
}

function normalizeNumber(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  return value.toFixed(2);
}

export async function saveSensorReading(input: SensorReadingInput): Promise<void> {
  await db.insert(sensorReadingsTable).values({
    source: input.source,
    temperature: normalizeNumber(input.temperature),
    humidity: normalizeNumber(input.humidity),
    luminosity: normalizeNumber(input.luminosity),
    recordedAt: input.timestamp ? new Date(input.timestamp) : new Date(),
    rawPayload: input.rawPayload ?? null,
  });
}

export async function saveCommandLog(input: CommandLogInput): Promise<void> {
  await db.insert(commandLogsTable).values({
    command: input.command,
    source: input.source,
    status: input.status,
    detail: input.detail ?? null,
  });
}

export async function getRecentSensorReadings(limit = 50) {
  const safeLimit = Math.max(1, Math.min(limit, 500));

  return db
    .select()
    .from(sensorReadingsTable)
    .orderBy(desc(sensorReadingsTable.recordedAt))
    .limit(safeLimit);
}
