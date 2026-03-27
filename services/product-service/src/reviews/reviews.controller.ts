import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";

import type { CreateReviewDto } from "./dto/create-review.dto";
import type { ListReviewsQueryDto } from "./dto/list-reviews-query.dto";
import type { PaginatedReviewsResponseDto } from "./dto/paginated-reviews-response.dto";
import type { ReviewResponseDto } from "./dto/review-response.dto";
import type { UpdateReviewDto } from "./dto/update-review.dto";
import type { ReviewsService } from "./reviews.service";

@Controller("products/:productId/reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(
    @Param("productId") productId: string,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.create(productId, createReviewDto);
  }

  @Get()
  findAll(
    @Param("productId") productId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<PaginatedReviewsResponseDto> {
    return this.reviewsService.findAll(productId, query);
  }

  @Patch(":reviewId")
  update(
    @Param("productId") productId: string,
    @Param("reviewId") reviewId: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.update(productId, reviewId, updateReviewDto);
  }

  @Delete(":reviewId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("productId") productId: string,
    @Param("reviewId") reviewId: string,
  ): Promise<void> {
    await this.reviewsService.remove(productId, reviewId);
  }
}
