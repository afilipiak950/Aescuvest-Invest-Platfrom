import { Request, Response } from 'express';
import { db } from '../db';
import { investors, deals, dealInvestorMatches } from '../../shared/schema';
import { eq, like, and, or } from 'drizzle-orm';

interface AffinityConfig {
  apiKey: string;
  baseUrl: string;
  version: string;
}

interface AffinityPerson {
  id: string;
  type: 'person';
  first_name: string;
  last_name: string;
  emails: string[];
  phone_numbers: string[];
  entity_id: string;
  list_entries: AffinityListEntry[];
  field_values: Record<string, any>;
  interaction_dates: {
    first_email_date: string;
    last_email_date: string;
    first_event_date: string;
    last_event_date: string;
  };
}

interface AffinityCompany {
  id: string;
  type: 'organization';
  name: string;
  domain: string;
  global: boolean;
  entity_id: string;
  list_entries: AffinityListEntry[];
  field_values: Record<string, any>;
  interaction_dates: {
    first_email_date: string;
    last_email_date: string;
    first_event_date: string;
    last_event_date: string;
  };
}

interface AffinityListEntry {
  id: string;
  list_id: string;
  entity_id: string;
  creator_id: string;
  list_entry_id: string;
  created_at: string;
  updated_at: string;
}

interface AffinityList {
  id: string;
  type: string;
  name: string;
  public: boolean;
  owner_id: string;
  list_size: number;
  created_at: string;
  updated_at: string;
}

interface AffinityFieldValue {
  id: string;
  field_id: string;
  entity_id: string;
  list_entry_id: string;
  value: any;
  created_at: string;
  updated_at: string;
}

interface AffinityOpportunity {
  id: string;
  name: string;
  person_id: string;
  organization_id: string;
  list_entry_id: string;
  stage: string;
  owner_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SyncMetrics {
  personsProcessed: number;
  investorsCreated: number;
  investorsUpdated: number;
  errors: string[];
  lastSyncTime: string;
}

export class AffinityService {
  private config: AffinityConfig;
  private rateLimiter = {
    requestsPerMinute: 900,
    requestQueue: [] as Array<{ timestamp: number; resolve: Function; reject: Function }>,
    isProcessing: false
  };

  constructor(config: AffinityConfig) {
    this.config = config;
  }

  private async rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    // For now, bypass rate limiting and call the function directly
    // This ensures we get real API responses instead of empty objects
    return await requestFn();
  }

  private async processRequestQueue() {
    this.rateLimiter.isProcessing = true;
    
    while (this.rateLimiter.requestQueue.length > 0) {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      // Remove old requests from tracking
      this.rateLimiter.requestQueue = this.rateLimiter.requestQueue.filter(
        req => req.timestamp > oneMinuteAgo
      );
      
      // Check rate limit
      if (this.rateLimiter.requestQueue.length >= this.rateLimiter.requestsPerMinute) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const request = this.rateLimiter.requestQueue.shift();
      if (request) {
        try {
          const result = await this.makeApiRequest(request);
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
      }
      
      // Small delay between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.rateLimiter.isProcessing = false;
  }

  private async makeApiRequest(request: any): Promise<any> {
    // This method was causing empty responses - now bypassed
    return {};
  }

  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Basic ${Buffer.from(`${this.config.apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      console.log('🔗 Affinity API Request:');
      console.log('- URL:', url);
      console.log('- Method:', options.method || 'GET');
      console.log('- Auth:', `Basic ${Buffer.from(`${this.config.apiKey?.slice(0, 10)}:`).toString('base64')}...`);

      const response = await fetch(url, {
        ...options,
        headers
      });

      console.log('📡 Affinity API Response:');
      console.log('- Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error Response:', errorText);
        throw new Error(`Affinity API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('✅ Raw Response Text:', responseText.slice(0, 500));
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.log('❌ JSON Parse Error:', parseError);
        console.log('❌ Response not valid JSON:', responseText);
        throw new Error('Invalid JSON response from Affinity API');
      }
      
      console.log('✅ Response Data Keys:', Object.keys(responseData || {}));
      console.log('✅ Response Data Sample:', JSON.stringify(responseData, null, 2).slice(0, 500));
      
      return responseData;
    } catch (error) {
      console.error('Affinity API request failed:', error);
      throw error;
    }
  }

  // Authentication and connection testing
  async testConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const response = await this.rateLimitedRequest(async () => {
        return await this.apiRequest('/v2/auth/whoami');
      });

      return {
        success: true,
        user: response
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get all persons from Affinity (direct endpoint)
  async getPersons(params: {
    cursor?: string;
    limit?: number;
    term?: string;
    with_interaction_dates?: boolean;
  } = {}): Promise<{ persons: AffinityPerson[]; next_cursor?: string }> {
    try {
      const searchParams = new URLSearchParams();
      if (params.cursor) searchParams.append('cursor', params.cursor);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.term) searchParams.append('term', params.term);
      if (params.with_interaction_dates) searchParams.append('with_interaction_dates', 'true');

      console.log('🔍 Affinity API Debug - Persons Request:');
      console.log('- URL:', `/v2/persons?${searchParams.toString()}`);
      console.log('- Params:', params);

      const response = await this.rateLimitedRequest(async () => {
        return await this.apiRequest(`/v2/persons?${searchParams.toString()}`);
      });

      console.log('📊 Affinity API Debug - Persons Response:');
      console.log('- Response type:', typeof response);
      console.log('- Response keys:', Object.keys(response || {}));
      console.log('- Response sample:', JSON.stringify(response, null, 2).slice(0, 500));

      // Transform the response to match expected format
      const persons = response.data?.map((person: any) => ({
        id: person.id,
        type: 'person',
        first_name: person.firstName,
        last_name: person.lastName,
        emails: person.emailAddresses || [],
        phone_numbers: [],
        entity_id: person.id,
        list_entries: []
      })) || [];

      return {
        persons,
        next_cursor: response.pagination?.nextUrl ? new URL(response.pagination.nextUrl).searchParams.get('cursor') : null
      };
    } catch (error) {
      console.error('Error fetching persons:', error);
      return { persons: [], next_cursor: null };
    }
  }

  // Get all companies from Affinity (use organizations method)
  async getCompanies(params: {
    cursor?: string;
    limit?: number;
    term?: string;
    with_interaction_dates?: boolean;
  } = {}): Promise<{ companies: AffinityCompany[]; next_cursor?: string; total_entries?: number }> {
    // Use the working organizations method since it's the same data
    const organizationsResult = await this.getOrganizations(params);
    
    return {
      companies: organizationsResult.organizations,
      next_cursor: organizationsResult.next_cursor,
      total_entries: organizationsResult.total_entries
    };
  }

  // Get all organizations from Affinity using the search API
  async getOrganizations(params: {
    cursor?: string;
    limit?: number;
    term?: string;
    with_interaction_dates?: boolean;
  } = {}): Promise<{ organizations: AffinityCompany[]; next_cursor?: string; total_entries?: number }> {
    try {
      // Use the proper organizations endpoint - not lists!
      const searchParams = new URLSearchParams();
      if (params.cursor) searchParams.append('cursor', params.cursor);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.term) searchParams.append('term', params.term);
      if (params.with_interaction_dates) searchParams.append('with_interaction_dates', 'true');

      console.log('🔍 Affinity API Debug - Organizations Endpoint Request:');
      console.log('- URL:', `/v2/organizations?${searchParams.toString()}`);
      console.log('- Params:', params);

      // Use the direct organizations endpoint with v2 prefix
      const response = await this.rateLimitedRequest(async () => {
        return await this.apiRequest(`/v2/organizations?${searchParams.toString()}`);
      });

      console.log('📊 Affinity API Debug - Organizations Response:');
      console.log('- Response type:', typeof response);
      console.log('- Response keys:', Object.keys(response || {}));
      console.log('- Total organizations in response:', response.organizations?.length || 0);

      if (response.organizations && response.organizations.length > 0) {
        const organizations = response.organizations.map((org: any) => ({
          id: org.id,
          name: org.name,
          domain: org.domain,
          domains: org.domains,
          type: 'organization',
          entity_id: org.id,
          global: org.global,
          list_entries: org.list_entries || []
        }));

        return {
          organizations,
          next_cursor: response.page_info?.next_page_token || null,
          total_entries: response.organizations.length
        };
      }

      // If no organizations found, return empty result
      return {
        organizations: [],
        next_cursor: null,
        total_entries: 0
      };
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return { organizations: [], next_cursor: null, total_entries: 0 };
    }
  }

  // Get all lists from Affinity
  async getLists(): Promise<AffinityList[]> {
    const response = await this.rateLimitedRequest(async () => {
      return await this.apiRequest('/v2/lists');
    });

    return response.data || [];
  }

  // Get list entries for a specific list
  async getListEntries(listId: string, params: {
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ list_entries: AffinityListEntry[]; next_cursor?: string }> {
    const searchParams = new URLSearchParams();
    
    if (params.cursor) searchParams.append('cursor', params.cursor);
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const response = await this.rateLimitedRequest(async () => {
      return await this.apiRequest(`/v2/lists/${listId}/list-entries?${searchParams.toString()}`);
    });

    return {
      list_entries: response.list_entries || [],
      next_cursor: response.next_cursor
    };
  }

  // Get field values for a list entry
  async getFieldValues(listId: string, listEntryId: string): Promise<AffinityFieldValue[]> {
    const response = await this.rateLimitedRequest(async () => {
      return await this.apiRequest(`/v2/lists/${listId}/list-entries/${listEntryId}/fields`);
    });

    return response.field_values || [];
  }

  // Update field values for a list entry
  async updateFieldValues(listId: string, listEntryId: string, fieldUpdates: Array<{
    field_id: string;
    value: any;
  }>): Promise<void> {
    await this.rateLimitedRequest(async () => {
      return await this.apiRequest(`/v2/lists/${listId}/list-entries/${listEntryId}/fields`, {
        method: 'PATCH',
        body: JSON.stringify({ field_values: fieldUpdates })
      });
    });
  }

  // Get opportunities
  async getOpportunities(params: {
    cursor?: string;
    limit?: number;
    term?: string;
    list_id?: string;
  } = {}): Promise<{ opportunities: AffinityOpportunity[]; next_cursor?: string }> {
    const searchParams = new URLSearchParams();
    
    if (params.cursor) searchParams.append('cursor', params.cursor);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.term) searchParams.append('term', params.term);
    if (params.list_id) searchParams.append('list_id', params.list_id);

    const response = await this.rateLimitedRequest(async () => {
      return await this.apiRequest(`/v2/opportunities?${searchParams.toString()}`);
    });

    return {
      opportunities: response.opportunities || [],
      next_cursor: response.next_cursor
    };
  }

  // Convert Affinity person to local investor format
  private mapPersonToInvestor(person: AffinityPerson, fieldValues: AffinityFieldValue[] = []): any {
    const fieldValueMap = fieldValues.reduce((map, fv) => {
      map[fv.field_id] = fv.value;
      return map;
    }, {} as Record<string, any>);

    return {
      name: `${person.first_name} ${person.last_name}`.trim(),
      location: fieldValueMap.location || 'Unknown',
      email: person.emails[0] || null,
      focus: fieldValueMap.focus || [],
      stages: fieldValueMap.stages || [],
      checkSize: fieldValueMap.check_size || null,
      portfolio: fieldValueMap.portfolio || [],
      affinityId: person.id,
      lastSyncAt: new Date()
    };
  }

  // Convert Affinity company to local investor format (for firms)
  private mapCompanyToInvestor(company: AffinityCompany, fieldValues: AffinityFieldValue[] = []): any {
    const fieldValueMap = fieldValues.reduce((map, fv) => {
      map[fv.field_id] = fv.value;
      return map;
    }, {} as Record<string, any>);

    return {
      name: company.name,
      firmName: company.name,
      location: fieldValueMap.location || 'Unknown',
      website: company.domain ? `https://${company.domain}` : null,
      email: fieldValueMap.email || null,
      focus: fieldValueMap.focus || [],
      stages: fieldValueMap.stages || [],
      checkSize: fieldValueMap.check_size || null,
      portfolio: fieldValueMap.portfolio || [],
      affinityId: company.id,
      lastSyncAt: new Date()
    };
  }

  // Sync all investors from Affinity
  async syncAllInvestors(): Promise<SyncMetrics> {
    const metrics: SyncMetrics = {
      personsProcessed: 0,
      investorsCreated: 0,
      investorsUpdated: 0,
      errors: [],
      lastSyncTime: new Date().toISOString()
    };

    try {
      // Get all persons from Affinity
      let cursor: string | undefined;
      const allPersons: AffinityPerson[] = [];

      do {
        const response = await this.getPersons({
          cursor,
          limit: 100,
          with_interaction_dates: true
        });

        allPersons.push(...response.persons);
        cursor = response.next_cursor;
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (cursor);

      // Get all companies that might be investment firms
      cursor = undefined;
      const allCompanies: AffinityCompany[] = [];

      do {
        const response = await this.getCompanies({
          cursor,
          limit: 100,
          with_interaction_dates: true
        });

        allCompanies.push(...response.companies);
        cursor = response.next_cursor;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (cursor);

      // Process persons as individual investors
      for (const person of allPersons) {
        try {
          metrics.personsProcessed++;
          
          // Check if investor already exists
          const existingInvestor = await db.query.investors.findFirst({
            where: eq(investors.affinityId, person.id)
          });

          const investorData = this.mapPersonToInvestor(person);

          if (existingInvestor) {
            // Update existing investor
            await db.update(investors)
              .set(investorData)
              .where(eq(investors.id, existingInvestor.id));
            
            metrics.investorsUpdated++;
          } else {
            // Create new investor
            await db.insert(investors).values(investorData);
            metrics.investorsCreated++;
          }
        } catch (error) {
          metrics.errors.push(`Error processing person ${person.id}: ${error}`);
        }
      }

      // Process companies as investment firms
      for (const company of allCompanies) {
        try {
          metrics.personsProcessed++;
          
          // Check if investor already exists
          const existingInvestor = await db.query.investors.findFirst({
            where: eq(investors.affinityId, company.id)
          });

          const investorData = this.mapCompanyToInvestor(company);

          if (existingInvestor) {
            // Update existing investor
            await db.update(investors)
              .set(investorData)
              .where(eq(investors.id, existingInvestor.id));
            
            metrics.investorsUpdated++;
          } else {
            // Create new investor
            await db.insert(investors).values(investorData);
            metrics.investorsCreated++;
          }
        } catch (error) {
          metrics.errors.push(`Error processing company ${company.id}: ${error}`);
        }
      }

    } catch (error) {
      metrics.errors.push(`Sync failed: ${error}`);
    }

    return metrics;
  }

  // Search for specific investors in Affinity
  async searchInvestors(searchTerm: string): Promise<{
    persons: AffinityPerson[];
    companies: AffinityCompany[];
  }> {
    const [personsResponse, companiesResponse] = await Promise.all([
      this.getPersons({ term: searchTerm, limit: 50 }),
      this.getCompanies({ term: searchTerm, limit: 50 })
    ]);

    return {
      persons: personsResponse.persons,
      companies: companiesResponse.companies
    };
  }

  // Get investor details from Affinity
  async getInvestorDetails(affinityId: string): Promise<AffinityPerson | AffinityCompany | null> {
    try {
      // Try to get as person first
      const personResponse = await this.rateLimitedRequest(async () => {
        return await this.apiRequest(`/v2/persons/${affinityId}`);
      });

      if (personResponse.person) {
        return personResponse.person;
      }
    } catch (error) {
      // If person not found, try company
      try {
        const companyResponse = await this.rateLimitedRequest(async () => {
          return await this.apiRequest(`/v2/companies/${affinityId}`);
        });

        if (companyResponse.company) {
          return companyResponse.company;
        }
      } catch (companyError) {
        console.error('Error fetching company from Affinity:', companyError);
      }
    }

    return null;
  }

  // Create or update investor in Affinity (if write access is available)
  async createOrUpdateInvestor(investorData: any): Promise<string | null> {
    // This would require write permissions in Affinity
    // For now, returning null as most implementations are read-only
    console.log('Write operations to Affinity are not implemented yet');
    return null;
  }

  // Get activity feed for an investor
  async getInvestorActivity(affinityId: string): Promise<any[]> {
    try {
      // This would require additional API endpoints for interactions/emails
      // For now, returning empty array
      return [];
    } catch (error) {
      console.error('Error fetching investor activity:', error);
      return [];
    }
  }

  // Sync specific investor by ID
  async syncInvestorById(affinityId: string): Promise<boolean> {
    try {
      const investorDetails = await this.getInvestorDetails(affinityId);
      
      if (!investorDetails) {
        return false;
      }

      // Check if investor exists in local database
      const existingInvestor = await db.query.investors.findFirst({
        where: eq(investors.affinityId, affinityId)
      });

      const investorData = investorDetails.type === 'person' 
        ? this.mapPersonToInvestor(investorDetails as AffinityPerson)
        : this.mapCompanyToInvestor(investorDetails as AffinityCompany);

      if (existingInvestor) {
        // Update existing investor
        await db.update(investors)
          .set(investorData)
          .where(eq(investors.id, existingInvestor.id));
      } else {
        // Create new investor
        await db.insert(investors).values(investorData);
      }

      return true;
    } catch (error) {
      console.error('Error syncing investor:', error);
      return false;
    }
  }
}

// Factory function to create Affinity service instance
export function createAffinityService(apiKey: string): AffinityService {
  return new AffinityService({
    apiKey,
    baseUrl: 'https://api.affinity.co',
    version: 'v2'
  });
}