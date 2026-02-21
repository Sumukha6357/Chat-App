import { IsArray, ArrayNotEmpty } from 'class-validator';

export class MarkNotificationsReadDto {
  @IsArray()
  @ArrayNotEmpty()
  ids!: string[];
}
