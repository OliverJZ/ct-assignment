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

import type { CreateProductDto } from "./dto/create-product.dto";
import type { ListProductsQueryDto } from "./dto/list-products-query.dto";
import type { PaginatedProductsResponseDto } from "./dto/paginated-products-response.dto";
import type { ProductResponseDto } from "./dto/product-response.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedProductsResponseDto> {
    return this.productsService.findAll(query);
  }

  @Get(":productId")
  findOne(@Param("productId") productId: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(productId);
  }

  @Patch(":productId")
  update(
    @Param("productId") productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(productId, updateProductDto);
  }

  @Delete(":productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("productId") productId: string): Promise<void> {
    await this.productsService.remove(productId);
  }
}
