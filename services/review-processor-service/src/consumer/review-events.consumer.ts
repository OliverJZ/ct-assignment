import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Kafka, logLevel } from "kafkajs";

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
  private readonly logger = new Logger(ReviewEventsConsumer.name);

  private readonly kafka = new Kafka({
    clientId: "review-processor-service",
    brokers: REDPANDA_BROKERS,
    logLevel: logLevel.NOTHING,
  });

  private readonly consumer = this.kafka.consumer({
    groupId: REVIEW_CONSUMER_GROUP,
  });

  constructor(
    @Inject(RatingProjectionService)
    private readonly ratingProjectionService: RatingProjectionService,
  ) {}

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: REVIEW_EVENTS_TOPIC,
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          return;
        }

        const event = JSON.parse(message.value.toString()) as ReviewEvent;

        this.logger.log(
          `Received ${event.eventType} event for product ${event.productId} review ${event.reviewId} partition=${partition} offset=${message.offset} topic=${topic}`,
        );

        const result = await this.ratingProjectionService.processReviewEvent({
          ...event,
          partition,
          offset: message.offset,
        });

        this.logger.log(
          `Processed event ${event.eventId} (${result.status}) for product ${event.productId}`,
        );
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
