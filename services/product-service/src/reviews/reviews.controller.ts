import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";

// Nest validation needs runtime class metadata for request DTOs.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateReviewDto } from "./dto/create-review.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListReviewsQueryDto } from "./dto/list-reviews-query.dto";
import type { PaginatedReviewsResponseDto } from "./dto/paginated-reviews-response.dto";
import type { ReviewResponseDto } from "./dto/review-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateReviewDto } from "./dto/update-review.dto";
import { ReviewsService } from "./reviews.service";

@Controller("products/:productId/reviews")
export class ReviewsController {
  constructor(
    @Inject(ReviewsService)
    private readonly reviewsService: ReviewsService,
  ) {}

  @Post()
  create(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.create(productId, createReviewDto);
  }

  @Get()
  findAll(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<PaginatedReviewsResponseDto> {
    return this.reviewsService.findAll(productId, query);
  }

  @Patch(":reviewId")
  update(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Param("reviewId", new ParseUUIDPipe()) reviewId: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.update(productId, reviewId, updateReviewDto);
  }

  @Delete(":reviewId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Param("reviewId", new ParseUUIDPipe()) reviewId: string,
  ): Promise<void> {
    await this.reviewsService.remove(productId, reviewId);
  }
}
