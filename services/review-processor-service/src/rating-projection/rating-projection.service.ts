import { Inject, Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../database/prisma.service";
import { MetricsService } from "../observability/metrics.service";

type ProcessReviewEventInput = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  productId: string;
  reviewId: string;
  partition?: number;
  offset?: string;
};

type ProcessReviewEventResult = {
  status: "processed" | "skipped";
};

@Injectable()
export class RatingProjectionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CacheService) private readonly cache: CacheService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async processReviewEvent(
    input: ProcessReviewEventInput,
  ): Promise<ProcessReviewEventResult> {
    const existingEvent = await this.prisma.processedEvent.findUnique({
      where: { eventId: input.eventId },
      select: { eventId: true },
    });

    if (existingEvent) {
      return { status: "skipped" };
    }

    const reviews = await this.prisma.review.findMany({
      where: { productId: input.productId },
      select: { rating: true },
    });

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount === 0
        ? null
        : new Decimal(
            (
              reviews.reduce(
                (sum: number, review: { rating: number }) =>
                  sum + review.rating,
                0,
              ) / reviewCount
            ).toFixed(2),
          );

    await this.prisma.productRating.upsert({
      where: { productId: input.productId },
      update: {
        averageRating,
        reviewCount,
        lastProcessedAt: new Date(input.occurredAt),
      },
      create: {
        productId: input.productId,
        averageRating,
        reviewCount,
        lastProcessedAt: new Date(input.occurredAt),
      },
    });

    try {
      await this.prisma.processedEvent.create({
        data: {
          eventId: input.eventId,
          eventType: input.eventType,
          productId: input.productId,
          reviewId: input.reviewId,
          partition: input.partition,
          offset: input.offset ? BigInt(input.offset) : null,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return { status: "skipped" };
      }

      throw error;
    }

    await this.cache.delete(this.cache.productDetailKey(input.productId));
    this.metrics.recordCacheInvalidation("product_detail");

    return { status: "processed" };
  }
}
