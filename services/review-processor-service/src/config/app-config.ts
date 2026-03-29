import { Injectable } from "@nestjs/common";

export type ReviewProcessorConfig = {
  logLevel: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  redpandaBrokers: string[];
  reviewEventsTopic: string;
  reviewConsumerGroup: string;
  otelExporterEndpoint: string;
  instanceId: string;
};

export function loadReviewProcessorConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReviewProcessorConfig {
  return {
    logLevel: env.LOG_LEVEL ?? "info",
    port: Number(env.REVIEW_PROCESSOR_PORT ?? 3001),
    databaseUrl:
      env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/ct_assignment?schema=public",
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379/0",
    redpandaBrokers: (env.REDPANDA_BROKERS ?? "localhost:19092")
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean),
    reviewEventsTopic: env.REVIEW_EVENTS_TOPIC ?? "review-events",
    reviewConsumerGroup: env.REVIEW_CONSUMER_GROUP ?? "review-processor",
    otelExporterEndpoint:
      env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
    instanceId: env.INSTANCE_ID ?? `review-processor-service-${process.pid}`,
  };
}

@Injectable()
export class AppConfigService {
  private readonly config = loadReviewProcessorConfig();

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

  get reviewConsumerGroup() {
    return this.config.reviewConsumerGroup;
  }

  get otelExporterEndpoint() {
    return this.config.otelExporterEndpoint;
  }

  get instanceId() {
    return this.config.instanceId;
  }
}
