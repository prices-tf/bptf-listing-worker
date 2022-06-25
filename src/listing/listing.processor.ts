import {
  Processor,
  Process,
  OnQueueFailed,
  OnQueueCompleted,
  InjectQueue,
} from '@nestjs/bull';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { LimiterService } from '../limiter/limiter.service';
import { ListingService } from './listing.service';

import { config } from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  // Hack to get environment variables when developing. Needed for concurrency
  // option in process annotation.
  config();
}

interface JobData {
  id: string;
}

interface JobResult {
  exists: boolean;
}

@Processor('listings')
export class ListingConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(ListingConsumer.name);

  constructor(
    private readonly listingService: ListingService,
    private readonly limiterService: LimiterService,
    @InjectQueue('listings')
    private readonly queue: Queue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    // Pause queue to prevent running more jobs
    await this.queue.pause(true, false);
  }

  @Process({
    concurrency: parseInt(process.env.LIMITER_MAX_CONCURRENT, 10),
  })
  async getListing(job: Job<JobData>): Promise<JobResult> {
    const listingId = job.data.id;

    let now: Date;

    const listing = await this.limiterService.schedule(() => {
      this.logger.log('Getting listing ' + listingId + '...');
      now = new Date();
      return this.listingService.getListing(listingId);
    });

    if (listing === null) {
      // Listing no longer exists, so mark it as deleted
      await this.listingService.saveListingAsDeleted(listingId);
    } else {
      // Listing exists, save it
      await this.listingService.saveListing(listing, now);
    }

    return {
      exists: listing !== null,
    };
  }

  @OnQueueCompleted()
  onQueueCompleted(job: Job<JobData>, result: JobResult) {
    this.logger.log(
      'Listing ' +
        job.data.id +
        ' ' +
        (result.exists ? 'exists' : 'does not exist'),
    );
  }

  @OnQueueFailed()
  onQueueFailed(job: Job, err: Error) {
    this.logger.error('Job with id ' + job.id + ' failed: ' + err.message);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (err?.isAxiosError === true) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      console.log(err.response?.data);
    }
  }
}
