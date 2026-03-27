import type { ReviewResponseDto } from "./review-response.dto";

export class PaginatedReviewsResponseDto {
  items!: ReviewResponseDto[];
  page!: number;
  limit!: number;
  total!: number;
}
