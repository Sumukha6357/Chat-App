import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AttachmentDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsIn(['image', 'file'])
  type!: 'image' | 'file';

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  size!: number;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ValidateIf((o) => !o.attachments || o.attachments.length === 0)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsString()
  type?: 'text' | 'image' | 'file' | 'system';

  @IsOptional()
  @IsString()
  clientMessageId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
