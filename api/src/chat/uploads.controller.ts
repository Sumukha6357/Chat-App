import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoomsService } from '../rooms/rooms.service';
import { Roles } from '../common/decorators/roles.decorator';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type MulterCallback = (error: Error | null, destination: string) => void;
type MulterNameCallback = (error: Error | null, filename: string) => void;

@Controller('uploads')
@Roles('user')
export class UploadsController {
  constructor(private readonly rooms: RoomsService) { }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file: any, cb: MulterCallback) => {
          const roomId = sanitizeRoomId(req.body?.roomId);
          if (!roomId) {
            cb(new BadRequestException('Missing roomId') as any, '');
            return;
          }
          const uploadDir = path.join(process.cwd(), 'uploads', roomId);
          fs.mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (req: any, file: any, cb: MulterNameCallback) => {
          const ext = path.extname(file.originalname || '');
          const safeExt = ext && ext.length <= 10 ? ext : '';
          const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (req: any, file: any, cb: (error: Error | null, accept: boolean) => void) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('Unsupported file type') as any, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const userId = req.user?.sub;
    const roomIdRaw = req.body?.roomId;
    const roomId = sanitizeRoomId(roomIdRaw);
    if (!roomId) {
      if (file?.path) fs.unlink(file.path, () => undefined);
      throw new BadRequestException('Missing roomId');
    }
    const isMember = await this.rooms.isMember(roomId, userId);
    if (!isMember) {
      if (file?.path) fs.unlink(file.path, () => undefined);
      throw new BadRequestException('Not a room member');
    }
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const type = file.mimetype.startsWith('image/') ? 'image' : 'file';
    const url = `/uploads/${roomId}/${file.filename}`;
    return {
      url,
      type,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}

function sanitizeRoomId(value?: string) {
  if (!value) return '';
  const safe = String(value).replace(/[^a-zA-Z0-9_-]/g, '');
  return safe;
}
