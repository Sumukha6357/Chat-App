import { SetMetadata } from '@nestjs/common';

export const IGNORE_ENVELOPE_KEY = 'ignoreEnvelope';
export const IgnoreEnvelope = () => SetMetadata(IGNORE_ENVELOPE_KEY, true);
