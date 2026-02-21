import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: 'direct' | 'group';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  members?: string[];
}
