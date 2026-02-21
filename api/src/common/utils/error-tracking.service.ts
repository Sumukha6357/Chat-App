import { Injectable } from '@nestjs/common';

@Injectable()
export class ErrorTrackingService {
  capture(exception: unknown) {
    void exception;
  }
}
