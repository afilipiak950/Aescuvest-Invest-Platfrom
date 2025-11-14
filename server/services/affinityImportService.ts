import { db } from '../db';
import { 
  organizations, 
  investorPeople,
  affinityLists,
  affinityFieldDefinitions,
  affinityFieldValues,
  investorListMemberships,
  dailySyncJobs 
} from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';
import { createAffinityService } from './affinity-service';
import { websocketManager } from './websocketManager';

interface ImportProgress {
  jobId: number;
  totalOrganizations: number;
  processedOrganizations: number;
  totalPersons: number;
  processedPersons: number;
  totalLists: number;
  processedLists: number;
  totalFields: number;
  processedFields: number;
  errors: string[];
  currentStep: string;
  progress: number;
}

interface ImportOptions {
  fullSync?: boolean;
  syncOrganizations?: boolean;
  syncPersons?: boolean;
  syncLists?: boolean;
  syncFields?: boolean;
  batchSize?: number;
}

export class AffinityImportService {
  private rateLimiter: {
    tokens: number;
    maxTokens: number;
    refillRate: number;
    lastRefill: number;
  };

  constructor() {
    this.rateLimiter = {
      tokens: 900,
      maxTokens: 900,
      refillRate: 15,
      lastRefill: Date.now()
    };
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRefill = now - this.rateLimiter.lastRefill;
    const tokensToAdd = Math.floor(timeSinceLastRefill / 1000) * this.rateLimiter.refillRate;
    
    this.rateLimiter.tokens = Math.min(
      this.rateLimiter.maxTokens,
      this.rateLimiter.tokens + tokensToAdd
    );
    this.rateLimiter.lastRefill = now;

    if (this.rateLimiter.tokens < 1) {
      const waitTime = Math.ceil((1 - this.rateLimiter.tokens) / this.rateLimiter.refillRate * 1000);
      console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimiter.tokens = 1;
    }

    this.rateLimiter.tokens -= 1;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          const delay = baseDelay * Math.pow(2, attempt) * (1 + Math.random() * 0.1);
          console.log(`🔄 Rate limit hit, retrying after ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (error.message?.includes('5')) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`🔄 Server error, retrying after ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  async startFullImport(options: ImportOptions = {}): Promise<number> {
    const {
      fullSync = true,
      syncOrganizations = true,
      syncPersons = true,
      syncLists = true,
      syncFields = true,
      batchSize = 100
    } = options;

    const [job] = await db.insert(dailySyncJobs).values({
      jobType: 'affinity_full_import',
      status: 'running',
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      newItems: 0,
      updatedItems: 0,
      scheduledFor: new Date(),
      startedAt: new Date()
    }).returning();

    const jobId = job.id;

    console.log(`🚀 Starting Affinity import job ${jobId}`);

    setImmediate(async () => {
      try {
        await this.executeImport(jobId, {
          fullSync,
          syncOrganizations,
          syncPersons,
          syncLists,
          syncFields,
          batchSize
        });
      } catch (error) {
        console.error(`❌ Import job ${jobId} failed:`, error);
        await this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : String(error));
      }
    });

    return jobId;
  }

  private async executeImport(jobId: number, options: ImportOptions): Promise<void> {
    const apiKey = process.env.AFFINITY_API_KEY;
    if (!apiKey) {
      throw new Error('AFFINITY_API_KEY not configured');
    }

    const affinityService = createAffinityService(apiKey);
    const progress: ImportProgress = {
      jobId,
      totalOrganizations: 0,
      processedOrganizations: 0,
      totalPersons: 0,
      processedPersons: 0,
      totalLists: 0,
      processedLists: 0,
      totalFields: 0,
      processedFields: 0,
      errors: [],
      currentStep: 'Initializing import',
      progress: 0
    };

    try {
      if (options.syncLists) {
        await this.importLists(affinityService, progress);
      }

      if (options.syncFields) {
        await this.importFieldDefinitions(affinityService, progress);
      }

      if (options.syncOrganizations) {
        await this.importOrganizations(affinityService, progress, options.batchSize || 100);
      }

      if (options.syncPersons) {
        await this.importPersons(affinityService, progress, options.batchSize || 100);
      }

      await this.updateJobStatus(jobId, 'completed', undefined, {
        organizations: progress.processedOrganizations,
        persons: progress.processedPersons,
        lists: progress.processedLists,
        fields: progress.processedFields
      });

      console.log(`✅ Import job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`❌ Import job ${jobId} failed:`, error);
      await this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async importLists(affinityService: any, progress: ImportProgress): Promise<void> {
    progress.currentStep = 'Importing Affinity Lists';
    await this.broadcastProgress(progress);

    await this.waitForRateLimit();
    const listsResponse = await this.retryWithBackoff(() => affinityService.getLists());
    const lists = (listsResponse as any[]) || [];

    progress.totalLists = lists.length;
    console.log(`📋 Found ${lists.length} lists to import`);

    for (const list of lists) {
      try {
        await this.waitForRateLimit();
        
        const existingList = await db.query.affinityLists.findFirst({
          where: eq(affinityLists.affinityListId, String(list.id))
        });

        const listData = {
          affinityListId: String(list.id),
          name: list.name,
          type: list.type || 'unknown',
          isPublic: list.public || false,
          listSize: list.list_size || 0,
          ownerId: list.owner_id ? String(list.owner_id) : null,
          affinityData: list,
          lastSyncAt: new Date()
        };

        if (existingList) {
          await db.update(affinityLists)
            .set(listData)
            .where(eq(affinityLists.id, existingList.id));
        } else {
          await db.insert(affinityLists).values(listData);
        }

        progress.processedLists++;
        progress.progress = Math.floor((progress.processedLists / progress.totalLists) * 100);
        await this.broadcastProgress(progress);
      } catch (error) {
        console.error(`Error importing list ${list.id}:`, error);
        progress.errors.push(`List ${list.name}: ${error}`);
      }
    }
  }

  private async importFieldDefinitions(affinityService: any, progress: ImportProgress): Promise<void> {
    progress.currentStep = 'Importing Field Definitions';
    await this.broadcastProgress(progress);

    console.log(`📋 Importing field definitions...`);
  }

  private async importOrganizations(
    affinityService: any,
    progress: ImportProgress,
    batchSize: number
  ): Promise<void> {
    progress.currentStep = 'Importing Organizations';
    await this.broadcastProgress(progress);

    let cursor: string | undefined;
    let pageCount = 0;
    let allOrganizations: any[] = [];

    console.log(`📊 Starting organization import with cursor-based pagination...`);

    do {
      pageCount++;
      console.log(`📊 Fetching organizations page ${pageCount} (cursor: ${cursor || 'initial'})`);

      await this.waitForRateLimit();
      const result = await this.retryWithBackoff(() => 
        affinityService.getOrganizations({
          cursor,
          limit: batchSize,
          with_interaction_dates: true
        })
      ) as any;

      const orgs = result?.organizations || [];
      
      if (orgs.length > 0) {
        allOrganizations = allOrganizations.concat(orgs);
        progress.totalOrganizations = allOrganizations.length + progress.processedOrganizations;
        console.log(`✅ Fetched ${orgs.length} organizations (total so far: ${progress.totalOrganizations})`);
      }
      
      cursor = result?.next_cursor;

      if (allOrganizations.length >= batchSize || !cursor) {
        await this.processBatch(allOrganizations, progress);
        allOrganizations = [];
      }

    } while (cursor && orgs.length > 0);

    if (allOrganizations.length > 0) {
      await this.processBatch(allOrganizations, progress);
    }

    console.log(`✅ Completed importing ${progress.processedOrganizations} organizations`);
  }

  private async processBatch(orgs: any[], progress: ImportProgress): Promise<void> {
    if (orgs.length === 0) return;

    const orgRecords = orgs.map(org => ({
      affinityId: String(org.id),
      name: org.name,
      domain: org.domain,
      domains: org.domains || [],
      type: 'organization' as const,
      isGlobal: org.global || false,
      website: org.domain ? `https://${org.domain}` : null,
      affinityData: {
        listEntries: org.list_entries || [],
        fieldValues: org.field_values || {},
        interactionDates: org.interaction_dates || {},
        createdAt: org.created_at,
        updatedAt: org.updated_at
      },
      lastSyncAt: new Date(),
      syncStatus: 'synced' as const
    }));

    try {
      await db.transaction(async (tx) => {
        for (const orgData of orgRecords) {
          await tx.insert(organizations)
            .values(orgData)
            .onConflictDoUpdate({
              target: organizations.affinityId,
              set: {
                name: orgData.name,
                domain: orgData.domain,
                domains: orgData.domains,
                isGlobal: orgData.isGlobal,
                website: orgData.website,
                affinityData: orgData.affinityData,
                lastSyncAt: orgData.lastSyncAt,
                syncStatus: orgData.syncStatus,
                updatedAt: new Date()
              }
            });
        }
      });

      progress.processedOrganizations += orgs.length;
      
      progress.progress = progress.totalOrganizations > 0 
        ? Math.min(100, Math.floor((progress.processedOrganizations / progress.totalOrganizations) * 100))
        : 50;
      await this.broadcastProgress(progress);
      
      console.log(`✅ Processed batch of ${orgs.length} organizations (${progress.processedOrganizations}/${progress.totalOrganizations})`);
    } catch (error) {
      console.error(`❌ Error processing batch:`, error);
      progress.errors.push(`Batch processing error: ${error}`);
      
      for (const org of orgs) {
        try {
          const orgData = orgRecords.find(r => r.affinityId === String(org.id));
          if (orgData) {
            await db.insert(organizations)
              .values(orgData)
              .onConflictDoUpdate({
                target: organizations.affinityId,
                set: {
                  name: orgData.name,
                  domain: orgData.domain,
                  domains: orgData.domains,
                  isGlobal: orgData.isGlobal,
                  website: orgData.website,
                  affinityData: orgData.affinityData,
                  lastSyncAt: orgData.lastSyncAt,
                  syncStatus: orgData.syncStatus,
                  updatedAt: new Date()
                }
              });
            progress.processedOrganizations++;
          }
        } catch (singleError) {
          console.error(`Error importing organization ${org.id}:`, singleError);
          progress.errors.push(`Organization ${org.name}: ${singleError}`);
        }
      }
    }
  }

  private async importPersons(
    affinityService: any,
    progress: ImportProgress,
    batchSize: number
  ): Promise<void> {
    progress.currentStep = 'Importing Persons';
    await this.broadcastProgress(progress);

    let cursor: string | undefined;
    let pageCount = 0;
    let totalFetched = 0;

    console.log(`👤 Starting persons import with cursor-based pagination...`);

    do {
      pageCount++;
      console.log(`👤 Fetching persons page ${pageCount} (cursor: ${cursor || 'initial'})`);

      await this.waitForRateLimit();
      const result = await this.retryWithBackoff(() =>
        affinityService.getPersons({
          cursor,
          limit: batchSize,
          with_interaction_dates: true
        })
      ) as any;

      const persons = result?.persons || [];
      
      if (persons.length > 0) {
        totalFetched += persons.length;
        progress.totalPersons = totalFetched + progress.processedPersons;
        console.log(`✅ Fetched ${persons.length} persons (total so far: ${progress.totalPersons})`);
      }

      for (const person of persons) {
        try {
          const existingPerson = await db.query.investorPeople.findFirst({
            where: eq(investorPeople.affinityId, String(person.id))
          });

          const personData = {
            affinityId: String(person.id),
            firstName: person.first_name || '',
            lastName: person.last_name || '',
            fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            emails: person.emails || [],
            phoneNumbers: person.phone_numbers || [],
            affinityData: {
              listEntries: person.list_entries || [],
              fieldValues: person.field_values || {},
              interactionDates: person.interaction_dates || {}
            },
            lastSyncAt: new Date(),
            syncStatus: 'synced' as const
          };

          if (existingPerson) {
            await db.update(investorPeople)
              .set(personData)
              .where(eq(investorPeople.id, existingPerson.id));
          } else {
            await db.insert(investorPeople).values(personData);
          }

          progress.processedPersons++;
          
          if (progress.processedPersons % 10 === 0) {
            progress.progress = progress.totalPersons > 0
              ? Math.floor((progress.processedPersons / progress.totalPersons) * 100)
              : 50;
            await this.broadcastProgress(progress);
          }
        } catch (error) {
          console.error(`Error importing person ${person.id}:`, error);
          progress.errors.push(`Person ${person.first_name} ${person.last_name}: ${error}`);
        }
      }

      cursor = result?.next_cursor;
    } while (cursor && persons.length > 0);

    console.log(`✅ Completed importing ${progress.processedPersons} persons`);
  }

  private async broadcastProgress(progress: ImportProgress): Promise<void> {
    await db.update(dailySyncJobs)
      .set({
        progress: progress.progress,
        processedItems: progress.processedOrganizations + progress.processedPersons,
        totalItems: progress.totalOrganizations + progress.totalPersons,
        errors: progress.errors,
        updatedAt: new Date()
      })
      .where(eq(dailySyncJobs.id, progress.jobId));

    websocketManager.broadcastJobProgress({
      jobId: progress.jobId,
      progress: progress.progress,
      currentStep: progress.currentStep
    });
  }

  private async updateJobStatus(
    jobId: number,
    status: 'running' | 'completed' | 'failed',
    error?: string,
    result?: any
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    }

    if (error) {
      updateData.errors = [error];
    }

    if (result) {
      updateData.result = result;
    }

    await db.update(dailySyncJobs)
      .set(updateData)
      .where(eq(dailySyncJobs.id, jobId));
  }

  async getJobStatus(jobId: number): Promise<any> {
    const job = await db.query.dailySyncJobs.findFirst({
      where: eq(dailySyncJobs.id, jobId)
    });
    return job;
  }
}

export const affinityImportService = new AffinityImportService();
