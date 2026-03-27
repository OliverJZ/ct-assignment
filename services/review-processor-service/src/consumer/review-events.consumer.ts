import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Kafka, logLevel } from "kafkajs";

import { AppLoggerService } from "../observability/logger.service";
import { MetricsService } from "../observability/metrics.service";
import { RatingProjectionService } from "../rating-projection/rating-projection.service";

type ReviewEventType = "review.created" | "review.updated" | "review.deleted";

type ReviewEvent = {
  eventId: string;
  eventType: ReviewEventType;
  occurredAt: string;
  productId: string;
  reviewId: string;
};

const REVIEW_EVENTS_TOPIC = process.env.REVIEW_EVENTS_TOPIC ?? "review-events";
const REVIEW_CONSUMER_GROUP =
  process.env.REVIEW_CONSUMER_GROUP ?? "review-processor";
const REDPANDA_BROKERS = (process.env.REDPANDA_BROKERS ?? "localhost:19092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

@Injectable()
export class ReviewEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly kafka = new Kafka({
    clientId: "review-processor-service",
    brokers: REDPANDA_BROKERS,
    logLevel: logLevel.NOTHING,
  });

  private readonly consumer = this.kafka.consumer({
    groupId: REVIEW_CONSUMER_GROUP,
  });

  constructor(
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService,
    @Inject(MetricsService)
    private readonly metrics: MetricsService,
    @Inject(RatingProjectionService)
    private readonly ratingProjectionService: RatingProjectionService,
  ) {}

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: REVIEW_EVENTS_TOPIC,
      fromBeginning: true,
    });

    this.logger.info("Subscribed review processor consumer", {
      topic: REVIEW_EVENTS_TOPIC,
      groupId: REVIEW_CONSUMER_GROUP,
      brokers: REDPANDA_BROKERS,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          return;
        }

        const event = JSON.parse(message.value.toString()) as ReviewEvent;
        const startedAt = performance.now();

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

          throw error;
        }
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
