import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import type { CacheService } from "../cache/cache.service";
import type { PrismaService } from "../database/prisma.service";
import { ProductsService } from "./products.service";

function buildProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "product-1",
    name: "Keyboard",
    description: "Mechanical keyboard",
    price: new Decimal("129.99"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    rating: null,
    ...overrides,
  };
}

describe("ProductsService", () => {
  const prisma = {
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaService;

  const cache = {
    getJson: vi.fn(),
    setJson: vi.fn(),
    delete: vi.fn(),
    deleteByPattern: vi.fn(),
    productDetailKey: vi.fn(
      (productId: string) => `product:${productId}:detail`,
    ),
    productReviewsPattern: vi.fn(
      (productId: string) => `product:${productId}:reviews:*`,
    ),
  } as unknown as CacheService;

  let service: ProductsService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProductsService(prisma, cache);
  });

  it("creates a product", async () => {
    vi.mocked(prisma.product.create).mockResolvedValue(buildProduct());

    const result = await service.create({
      name: "Keyboard",
      description: "Mechanical keyboard",
      price: "129.99",
    });

    expect(prisma.product.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      name: "Keyboard",
      price: "129.99",
      averageRating: null,
      reviewCount: 0,
    });
    expect(cache.setJson).toHaveBeenCalled();
  });

  it("returns paginated products", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([
      [buildProduct()],
      1,
    ] as never);

    const result = await service.findAll({ page: 2, limit: 10 });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toMatchObject({
      page: 2,
      limit: 10,
      total: 1,
    });
    expect(result.items).toHaveLength(1);
  });

  it("returns one product by id", async () => {
    vi.mocked(cache.getJson).mockResolvedValue(null);
    vi.mocked(prisma.product.findUnique).mockResolvedValue(buildProduct());

    const result = await service.findOne("product-1");

    expect(result.id).toBe("product-1");
  });

  it("returns cached product detail when present", async () => {
    vi.mocked(cache.getJson).mockResolvedValue({
      id: "product-1",
      name: "Keyboard",
      description: "Mechanical keyboard",
      price: "129.99",
      averageRating: null,
      reviewCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await service.findOne("product-1");

    expect(result.id).toBe("product-1");
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it("throws when product does not exist", async () => {
    vi.mocked(cache.getJson).mockResolvedValue(null);
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    await expect(service.findOne("missing-product")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates an existing product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: "product-1",
    } as never);
    vi.mocked(prisma.product.update).mockResolvedValue(
      buildProduct({ name: "Updated keyboard" }),
    );

    const result = await service.update("product-1", {
      name: "Updated keyboard",
    });

    expect(prisma.product.update).toHaveBeenCalled();
    expect(result.name).toBe("Updated keyboard");
  });

  it("deletes an existing product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: "product-1",
    } as never);
    vi.mocked(prisma.product.delete).mockResolvedValue(buildProduct() as never);

    await service.remove("product-1");

    expect(prisma.product.delete).toHaveBeenCalledWith({
      where: { id: "product-1" },
    });
    expect(cache.delete).toHaveBeenCalled();
    expect(cache.deleteByPattern).toHaveBeenCalled();
  });
});
