import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;
}
