import { Injectable } from "@nestjs/common";

export type ProductServiceConfig = {
  logLevel: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  redpandaBrokers: string[];
  reviewEventsTopic: string;
  otelExporterEndpoint: string;
  instanceId: string;
};

export function loadProductServiceConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProductServiceConfig {
  return {
    logLevel: env.LOG_LEVEL ?? "info",
    port: Number(env.PRODUCT_SERVICE_PORT ?? 3000),
    databaseUrl:
      env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/ct_assignment?schema=public",
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379/0",
    redpandaBrokers: (env.REDPANDA_BROKERS ?? "localhost:19092")
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean),
    reviewEventsTopic: env.REVIEW_EVENTS_TOPIC ?? "review-events",
    otelExporterEndpoint:
      env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
    instanceId: env.INSTANCE_ID ?? `product-service-${process.pid}`,
  };
}

@Injectable()
export class AppConfigService {
  private readonly config = loadProductServiceConfig();

  get logLevel() {
    return this.config.logLevel;
  }

  get port() {
    return this.config.port;
  }

  get databaseUrl() {
    return this.config.databaseUrl;
  }

  get redisUrl() {
    return this.config.redisUrl;
  }

  get redpandaBrokers() {
    return this.config.redpandaBrokers;
  }

  get reviewEventsTopic() {
    return this.config.reviewEventsTopic;
  }

  get otelExporterEndpoint() {
    return this.config.otelExporterEndpoint;
  }

  get instanceId() {
    return this.config.instanceId;
  }
}
