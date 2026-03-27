import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { RatingProjectionService } from "./rating-projection.service";

describe("RatingProjectionService", () => {
  const prisma = {
    processedEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
    },
    productRating: {
      upsert: vi.fn(),
    },
  } as unknown as PrismaService;

  let service: RatingProjectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RatingProjectionService(prisma);
  });

  it("skips an already processed event", async () => {
    vi.mocked(prisma.processedEvent.findUnique).mockResolvedValue({
      eventId: "evt-1",
    } as never);

    const result = await service.processReviewEvent({
      eventId: "evt-1",
      eventType: "review.created",
      occurredAt: "2026-03-27T20:00:00.000Z",
      productId: "product-1",
      reviewId: "review-1",
    });

    expect(result).toEqual({ status: "skipped" });
    expect(prisma.productRating.upsert).not.toHaveBeenCalled();
  });

  it("persists recomputed rating projection", async () => {
    vi.mocked(prisma.processedEvent.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
    ] as never);
    vi.mocked(prisma.productRating.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.processedEvent.create).mockResolvedValue({} as never);

    const result = await service.processReviewEvent({
      eventId: "evt-2",
      eventType: "review.updated",
      occurredAt: "2026-03-27T20:00:00.000Z",
      productId: "product-1",
      reviewId: "review-1",
      partition: 1,
      offset: "42",
    });

    expect(result).toEqual({ status: "processed" });
    expect(prisma.productRating.upsert).toHaveBeenCalled();
    expect(prisma.processedEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "evt-2",
        productId: "product-1",
        reviewId: "review-1",
        partition: 1,
        offset: BigInt(42),
      }),
    });
  });

  it("stores null average for products without reviews", async () => {
    vi.mocked(prisma.processedEvent.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.review.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.productRating.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.processedEvent.create).mockResolvedValue({} as never);

    await service.processReviewEvent({
      eventId: "evt-3",
      eventType: "review.deleted",
      occurredAt: "2026-03-27T20:00:00.000Z",
      productId: "product-1",
      reviewId: "review-1",
    });

    expect(prisma.productRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          averageRating: null,
          reviewCount: 0,
        }),
      }),
    );
  });

  it("skips duplicate create race on processed_events", async () => {
    vi.mocked(prisma.processedEvent.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      { rating: 5 },
    ] as never);
    vi.mocked(prisma.productRating.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.processedEvent.create).mockRejectedValue({
      message: "duplicate",
      code: "P2002",
    });

    const result = await service.processReviewEvent({
      eventId: "evt-4",
      eventType: "review.created",
      occurredAt: "2026-03-27T20:00:00.000Z",
      productId: "product-1",
      reviewId: "review-1",
    });

    expect(result).toEqual({ status: "skipped" });
  });
});
