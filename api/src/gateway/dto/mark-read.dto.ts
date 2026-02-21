import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class MarkReadDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsArray()
  @ArrayNotEmpty()
  messageIds!: string[];
}
