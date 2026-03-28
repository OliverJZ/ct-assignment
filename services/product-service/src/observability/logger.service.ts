import { ConsoleLogger, Injectable } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import pino, { type Logger } from "pino";

type LogContext = Record<string, unknown>;

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  private readonly logger: Logger;
  private readonly instanceId =
    process.env.INSTANCE_ID ?? `product-service-${process.pid}`;

  constructor() {
    super();

    this.logger = pino({
      level: process.env.LOG_LEVEL ?? "info",
      base: {
        service: "product-service",
        instanceId: this.instanceId,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  override log(message: string, context?: string) {
    this.logger.info({ context }, message);
  }

  override error(message: string, trace?: string, context?: string) {
    this.logger.error({ context, trace }, message);
  }

  override warn(message: string, context?: string) {
    this.logger.warn({ context }, message);
  }

  override debug(message: string, context?: string) {
    this.logger.debug({ context }, message);
  }

  override verbose(message: string, context?: string) {
    this.logger.trace({ context }, message);
  }

  info(message: string, fields: LogContext = {}) {
    this.logger.info(this.withTrace(fields), message);
  }

  errorWithFields(message: string, fields: LogContext = {}) {
    this.logger.error(this.withTrace(fields), message);
  }

  private withTrace(fields: LogContext): LogContext {
    const spanContext = trace.getActiveSpan()?.spanContext();

    return {
      ...fields,
      ...(spanContext
        ? {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
          }
        : {}),
    };
  }
}
