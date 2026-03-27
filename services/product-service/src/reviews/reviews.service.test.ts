import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CacheService } from "../cache/cache.service";
import type { PrismaService } from "../database/prisma.service";
import type { ReviewEventsPublisher } from "../events/review-events.publisher";
import { ReviewsService } from "./reviews.service";

function buildReview(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "review-1",
    productId: "product-1",
    firstName: "John",
    lastName: "Doe",
    reviewText: "Great keyboard",
    rating: 5,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("ReviewsService", () => {
  const prisma = {
    product: {
      findUnique: vi.fn(),
    },
    review: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaService;

  const reviewEventsPublisher = {
    publishCreated: vi.fn(),
    publishUpdated: vi.fn(),
    publishDeleted: vi.fn(),
  } as unknown as ReviewEventsPublisher;

  const cache = {
    getJson: vi.fn(),
    setJson: vi.fn(),
    deleteByPattern: vi.fn(),
    productReviewsPattern: vi.fn(
      (productId: string) => `product:${productId}:reviews:*`,
    ),
    productReviewsKey: vi.fn(
      (productId: string, page: number, limit: number) =>
        `product:${productId}:reviews:page:${page}:limit:${limit}`,
    ),
  } as unknown as CacheService;

  let service: ReviewsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewsService(prisma, cache, reviewEventsPublisher);
  });

  it("creates a review for an existing product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: "product-1",
    } as never);
    vi.mocked(prisma.review.create).mockResolvedValue(buildReview());

    const result = await service.create("product-1", {
      firstName: "John",
      lastName: "Doe",
      reviewText: "Great keyboard",
      rating: 5,
    });

    expect(prisma.review.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      productId: "product-1",
      rating: 5,
    });
    expect(reviewEventsPublisher.publishCreated).toHaveBeenCalledWith(
      "product-1",
      "review-1",
    );
    expect(cache.deleteByPattern).toHaveBeenCalled();
  });

  it("returns paginated reviews for a product", async () => {
    vi.mocked(cache.getJson).mockResolvedValue(null);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: "product-1",
    } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([
      [buildReview()],
      1,
    ] as never);

    const result = await service.findAll("product-1", { page: 1, limit: 20 });

    expect(result).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(result.items).toHaveLength(1);
    expect(cache.setJson).toHaveBeenCalled();
  });

  it("returns cached paginated reviews when present", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: "product-1",
    } as never);
    vi.mocked(cache.getJson).mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    });

    const result = await service.findAll("product-1", { page: 1, limit: 20 });

    expect(result.total).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates an existing review", async () => {
    vi.mocked(prisma.review.findFirst).mockResolvedValue({
      id: "review-1",
    } as never);
    vi.mocked(prisma.review.update).mockResolvedValue(
      buildReview({ reviewText: "Updated review" }),
    );

    const result = await service.update("product-1", "review-1", {
      reviewText: "Updated review",
    });

    expect(result.reviewText).toBe("Updated review");
    expect(reviewEventsPublisher.publishUpdated).toHaveBeenCalledWith(
      "product-1",
      "review-1",
    );
    expect(cache.deleteByPattern).toHaveBeenCalled();
  });

  it("deletes an existing review", async () => {
    vi.mocked(prisma.review.findFirst).mockResolvedValue({
      id: "review-1",
    } as never);
    vi.mocked(prisma.review.delete).mockResolvedValue(buildReview() as never);

    await service.remove("product-1", "review-1");

    expect(prisma.review.delete).toHaveBeenCalledWith({
      where: { id: "review-1" },
    });
    expect(reviewEventsPublisher.publishDeleted).toHaveBeenCalledWith(
      "product-1",
      "review-1",
    );
    expect(cache.deleteByPattern).toHaveBeenCalled();
  });

  it("throws when creating review for missing product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    await expect(
      service.create("missing-product", {
        firstName: "John",
        lastName: "Doe",
        reviewText: "Missing product",
        rating: 4,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws when review does not belong to product", async () => {
    vi.mocked(prisma.review.findFirst).mockResolvedValue(null);

    await expect(
      service.update("product-1", "missing-review", { rating: 3 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
