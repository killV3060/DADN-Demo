import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger";

export interface RealtimeSensorPayload {
  source: string;
  temperature: number | null;
  humidity: number | null;
  luminosity: number | null;
  timestamp: string | null;
  warnings: {
    temperatureHigh: boolean;
    humidityLow: boolean;
  };
}

let io: SocketIOServer | null = null;

export function initRealtime(server: HttpServer): void {
  if (io) {
    return;
  }

  io = new SocketIOServer(server, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");

    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, reason }, "Socket disconnected");
    });
  });
}

export function emitSensorUpdate(payload: RealtimeSensorPayload): void {
  io?.emit("sensor:update", payload);
}
