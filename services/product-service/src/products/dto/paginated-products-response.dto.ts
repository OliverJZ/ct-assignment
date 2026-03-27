import type { ProductResponseDto } from "./product-response.dto";

export class PaginatedProductsResponseDto {
  items!: ProductResponseDto[];
  page!: number;
  limit!: number;
  total!: number;
}
