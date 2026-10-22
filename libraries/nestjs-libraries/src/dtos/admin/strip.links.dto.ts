import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class StripLinksDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  providers: string[];
}
