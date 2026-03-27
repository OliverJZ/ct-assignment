import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import { ReviewEventsPublisher } from "../events/review-events.publisher";
import type { CreateReviewDto } from "./dto/create-review.dto";
import type { ListReviewsQueryDto } from "./dto/list-reviews-query.dto";
import type { PaginatedReviewsResponseDto } from "./dto/paginated-reviews-response.dto";
import { ReviewResponseDto } from "./dto/review-response.dto";
import type { UpdateReviewDto } from "./dto/update-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReviewEventsPublisher)
    private readonly reviewEventsPublisher: ReviewEventsPublisher,
  ) {}

  async create(
    productId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    await this.ensureProductExists(productId);

    const review = await this.prisma.review.create({
      data: {
        productId,
        firstName: createReviewDto.firstName,
        lastName: createReviewDto.lastName,
        reviewText: createReviewDto.reviewText,
        rating: createReviewDto.rating,
      },
    });

    await this.reviewEventsPublisher.publishCreated(productId, review.id);

    return ReviewResponseDto.fromReview(review);
  }

  async findAll(
    productId: string,
    query: ListReviewsQueryDto,
  ): Promise<PaginatedReviewsResponseDto> {
    await this.ensureProductExists(productId);

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return {
      items: reviews.map(ReviewResponseDto.fromReview),
      page,
      limit,
      total,
    };
  }

  async update(
    productId: string,
    reviewId: string,
    updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const existingReview = await this.ensureReviewExists(productId, reviewId);

    const review = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(updateReviewDto.firstName !== undefined
          ? { firstName: updateReviewDto.firstName }
          : {}),
        ...(updateReviewDto.lastName !== undefined
          ? { lastName: updateReviewDto.lastName }
          : {}),
        ...(updateReviewDto.reviewText !== undefined
          ? { reviewText: updateReviewDto.reviewText }
          : {}),
        ...(updateReviewDto.rating !== undefined
          ? { rating: updateReviewDto.rating }
          : {}),
      },
    });

    await this.reviewEventsPublisher.publishUpdated(
      productId,
      existingReview.id,
    );

    return ReviewResponseDto.fromReview(review);
  }

  async remove(productId: string, reviewId: string): Promise<void> {
    const review = await this.ensureReviewExists(productId, reviewId);
    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.reviewEventsPublisher.publishDeleted(productId, review.id);
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

  private async ensureReviewExists(
    productId: string,
    reviewId: string,
  ): Promise<{ id: string }> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, productId },
      select: { id: true },
    });

    if (!review) {
      throw new NotFoundException(
        `Review ${reviewId} for product ${productId} not found`,
      );
    }

    return review;
  }
}
