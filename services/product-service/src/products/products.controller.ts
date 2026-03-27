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
import { CreateProductDto } from "./dto/create-product.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import type { PaginatedProductsResponseDto } from "./dto/paginated-products-response.dto";
import type { ProductResponseDto } from "./dto/product-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
  ) {}

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
  findOne(
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.findOne(productId);
  }

  @Patch(":productId")
  update(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(productId, updateProductDto);
  }

  @Delete(":productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ): Promise<void> {
    await this.productsService.remove(productId);
  }
}
