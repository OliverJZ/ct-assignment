import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
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

  let service: ReviewsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewsService(prisma);
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
  });

  it("returns paginated reviews for a product", async () => {
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
