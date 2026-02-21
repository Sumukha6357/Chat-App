import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';

import { Public } from './decorators/public.decorator';
import { IgnoreEnvelope } from './decorators/ignore-envelope.decorator';

@Controller('metrics')
@Public()
@IgnoreEnvelope()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) { }

  @Get()
  async getMetrics() {
    return this.metrics.getMetrics();
  }
}
