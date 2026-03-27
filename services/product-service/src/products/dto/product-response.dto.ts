type ProductWithRating = {
  id: string;
  name: string;
  description: string;
  price: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
  rating: {
    averageRating: { toString(): string } | null;
    reviewCount: number;
  } | null;
};

export class ProductResponseDto {
  id!: string;
  name!: string;
  description!: string;
  price!: string;
  averageRating!: string | null;
  reviewCount!: number;
  createdAt!: string;
  updatedAt!: string;

  static fromProduct(product: ProductWithRating): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      averageRating: product.rating?.averageRating?.toString() ?? null,
      reviewCount: product.rating?.reviewCount ?? 0,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
