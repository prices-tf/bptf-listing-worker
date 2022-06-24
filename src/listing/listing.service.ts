import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config, Services } from '../common/config/configuration';
import { Listing } from './interfaces/listing.interface';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
  ) {}

  async saveListing(listing: Listing, time: Date): Promise<void> {
    const url = `${
      this.configService.get<Services>('services').listings
    }/listings`;

    await lastValueFrom(this.httpService.post<any>(url, { listing, time }));
  }

  async saveListingAsDeleted(listingId: string): Promise<void> {
    const url = `${
      this.configService.get<Services>('services').listings
    }/listings/id/${listingId}/deleted`;

    await lastValueFrom(this.httpService.post<any>(url));
  }

  async getListing(id: string): Promise<Listing> {
    const result = await lastValueFrom(
      this.httpService.get<any>(
        'https://backpack.tf/api/v2/classifieds/listings/' + id,
        {
          headers: {
            'X-Auth-Token': this.configService.get('bptfAccessToken'),
          },
        },
      ),
    )
      .then((response) => {
        return response.data;
      })
      .catch((err) => {
        if (err instanceof AxiosError) {
          if (err.response.status === 404) {
            return null;
          }
        }

        throw err;
      });

    return result;
  }
}
