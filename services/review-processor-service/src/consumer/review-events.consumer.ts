import { Inject, Injectable } from "@nestjs/common";
import {
  context,
  propagation,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { EachMessagePayload } from "kafkajs";
import { logLevel } from "kafkajs";

import { AppConfigService } from "../config/app-config";
import { AppLoggerService } from "../observability/logger.service";
import { MetricsService } from "../observability/metrics.service";
import { RatingProjectionService } from "../rating-projection/rating-projection.service";
import { KafkaConsumerBase } from "./kafka-consumer.base";

type ReviewEventType = "review.created" | "review.updated" | "review.deleted";

type ReviewEvent = {
  eventId: string;
  eventType: ReviewEventType;
  occurredAt: string;
  productId: string;
  reviewId: string;
};

const tracer = trace.getTracer("review-processor-consumer");

@Injectable()
export class ReviewEventsConsumer extends KafkaConsumerBase {
  private readonly reviewEventsTopic: string;

  private readonly reviewConsumerGroup: string;

  private readonly redpandaBrokers: string[];

  constructor(
    @Inject(AppConfigService) config: AppConfigService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService,
    @Inject(MetricsService)
    private readonly metrics: MetricsService,
    @Inject(RatingProjectionService)
    private readonly ratingProjectionService: RatingProjectionService,
  ) {
    super(
      "review-processor-service",
      config.redpandaBrokers,
      config.reviewConsumerGroup,
      logLevel.NOTHING,
    );

    this.reviewEventsTopic = config.reviewEventsTopic;
    this.reviewConsumerGroup = config.reviewConsumerGroup;
    this.redpandaBrokers = config.redpandaBrokers;
  }

  protected topic(): string {
    return this.reviewEventsTopic;
  }

  protected fromBeginning(): boolean {
    return true;
  }

  override async onModuleInit() {
    this.logger.info("Subscribed review processor consumer", {
      topic: this.reviewEventsTopic,
      groupId: this.reviewConsumerGroup,
      brokers: this.redpandaBrokers,
    });

    await super.onModuleInit();
  }

  protected async handleMessage({
    topic,
    partition,
    message,
  }: EachMessagePayload) {
    if (!message.value) {
      return;
    }

    const event = JSON.parse(message.value.toString()) as ReviewEvent;
    const startedAt = performance.now();
    const carrier = Object.fromEntries(
      Object.entries(message.headers ?? {}).map(([key, value]) => [
        key,
        Buffer.isBuffer(value)
          ? value.toString()
          : typeof value === "string"
            ? value
            : undefined,
      ]),
    );
    const extractedContext = propagation.extract(context.active(), carrier, {
      get: (headerCarrier, key) => headerCarrier[key],
      keys: (headerCarrier) => Object.keys(headerCarrier),
    });

    await tracer.startActiveSpan(
      "review-events.consume",
      {
        attributes: {
          "messaging.system": "kafka",
          "messaging.destination.name": topic,
          "messaging.operation": "process",
          "messaging.kafka.partition": partition,
          "messaging.kafka.offset": message.offset,
          "review.event_type": event.eventType,
          "review.product_id": event.productId,
          "review.review_id": event.reviewId,
        },
      },
      extractedContext,
      async (span) => {
        this.logger.info("Received review lifecycle event", {
          eventId: event.eventId,
          eventType: event.eventType,
          productId: event.productId,
          reviewId: event.reviewId,
          partition,
          offset: message.offset,
          topic,
        });

        try {
          const result = await this.ratingProjectionService.processReviewEvent({
            ...event,
            partition,
            offset: message.offset,
          });

          const durationMs = performance.now() - startedAt;
          this.metrics.recordReviewEvent(
            event.eventType,
            result.status,
            durationMs,
          );

          this.logger.info("Processed review lifecycle event", {
            eventId: event.eventId,
            eventType: event.eventType,
            productId: event.productId,
            reviewId: event.reviewId,
            status: result.status,
            durationMs: Number(durationMs.toFixed(2)),
          });
        } catch (error) {
          const durationMs = performance.now() - startedAt;
          this.metrics.recordReviewEvent(event.eventType, "failed", durationMs);

          this.logger.errorWithFields(
            "Failed to process review lifecycle event",
            {
              eventId: event.eventId,
              eventType: event.eventType,
              productId: event.productId,
              reviewId: event.reviewId,
              durationMs: Number(durationMs.toFixed(2)),
              error: error instanceof Error ? error.message : String(error),
            },
          );

          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });

          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
