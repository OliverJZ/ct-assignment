import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../database/prisma.service";
import { MetricsService } from "../observability/metrics.service";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { ListProductsQueryDto } from "./dto/list-products-query.dto";
import type { PaginatedProductsResponseDto } from "./dto/paginated-products-response.dto";
import { ProductResponseDto } from "./dto/product-response.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CacheService) private readonly cache: CacheService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.prisma.product.create({
      data: {
        name: createProductDto.name,
        description: createProductDto.description,
        price: new Decimal(createProductDto.price),
      },
      include: { rating: true },
    });

    const response = ProductResponseDto.fromProduct(product);
    await this.cache.setJson(this.cache.productDetailKey(product.id), response);
    this.metrics.recordCacheOperation("product_detail", "write");
    return response;
  }

  async findAll(
    query: ListProductsQueryDto,
  ): Promise<PaginatedProductsResponseDto> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        include: { rating: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.product.count(),
    ]);

    return {
      items: products.map(ProductResponseDto.fromProduct),
      page,
      limit,
      total,
    };
  }

  async findOne(productId: string): Promise<ProductResponseDto> {
    const cacheKey = this.cache.productDetailKey(productId);
    const cachedProduct =
      await this.cache.getJson<ProductResponseDto>(cacheKey);

    if (cachedProduct) {
      this.metrics.recordCacheOperation("product_detail", "hit");
      return cachedProduct;
    }

    this.metrics.recordCacheOperation("product_detail", "miss");

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { rating: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const response = ProductResponseDto.fromProduct(product);
    await this.cache.setJson(cacheKey, response);
    this.metrics.recordCacheOperation("product_detail", "write");
    return response;
  }

  async update(
    productId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    await this.ensureProductExists(productId);

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(updateProductDto.name !== undefined
          ? { name: updateProductDto.name }
          : {}),
        ...(updateProductDto.description !== undefined
          ? { description: updateProductDto.description }
          : {}),
        ...(updateProductDto.price !== undefined
          ? { price: new Decimal(updateProductDto.price) }
          : {}),
      },
      include: { rating: true },
    });

    const response = ProductResponseDto.fromProduct(product);
    await this.cache.setJson(this.cache.productDetailKey(productId), response);
    this.metrics.recordCacheOperation("product_detail", "write");
    return response;
  }

  async remove(productId: string): Promise<void> {
    await this.ensureProductExists(productId);
    await this.prisma.product.delete({ where: { id: productId } });
    await this.cache.delete(this.cache.productDetailKey(productId));
    this.metrics.recordCacheOperation("product_detail", "delete");
    await this.cache.deleteByPattern(
      this.cache.productReviewsPattern(productId),
    );
    this.metrics.recordCacheOperation("product_reviews", "delete");
  }

  private async ensureProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
  }
}
