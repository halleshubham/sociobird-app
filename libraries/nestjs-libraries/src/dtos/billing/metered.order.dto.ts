import { IsIn, IsString } from 'class-validator';

export class MeteredOrderDto {
  @IsString()
  pack: string;

  @IsIn(['INR', 'USD'])
  currency: 'INR' | 'USD';
}
