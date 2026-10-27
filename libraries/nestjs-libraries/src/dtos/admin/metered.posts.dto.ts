import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class MeteredPostsDto {
  // null puts the plan's own allowance back
  @ValidateIf((o) => o.limit !== null)
  @IsInt()
  @Min(0)
  @Max(1000000)
  limit: number | null;
}
