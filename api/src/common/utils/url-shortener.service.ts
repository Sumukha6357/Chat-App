import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

interface ShortenResponse {
  shortUrl?: string;
}

@Injectable()
export class UrlShortenerService {
  constructor(private readonly config: ConfigService) {}

  async shorten(originalUrl: string, customAlias?: string, expiresAt?: string): Promise<string> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = this.config.get('shortenerApiToken');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${this.config.get('shortenerBaseUrl')}/api/v1/urls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          originalUrl,
          customAlias,
          expiresAt,
        }),
      });
      if (!response.ok) {
        return originalUrl;
      }
      const payload = (await response.json()) as ShortenResponse;
      return payload.shortUrl || originalUrl;
    } catch {
      return originalUrl;
    }
  }
}
