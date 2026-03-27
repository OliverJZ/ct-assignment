type ReviewRecord = {
  id: string;
  productId: string;
  firstName: string;
  lastName: string;
  reviewText: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
};

export class ReviewResponseDto {
  id!: string;
  productId!: string;
  firstName!: string;
  lastName!: string;
  reviewText!: string;
  rating!: number;
  createdAt!: string;
  updatedAt!: string;

  static fromReview(review: ReviewRecord): ReviewResponseDto {
    return {
      id: review.id,
      productId: review.productId,
      firstName: review.firstName,
      lastName: review.lastName,
      reviewText: review.reviewText,
      rating: review.rating,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }
}
