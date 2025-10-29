import { QueryClient } from "@tanstack/react-query";

// Default baseUrl for API requests
// 🚨 CRITICAL FIX: Dynamic baseUrl to handle Replit development environment
const baseUrl = (() => {
  if (typeof window === 'undefined') return '';
  
  const hostname = window.location.hostname;
  console.log(`🔍 DEBUG: Computing baseUrl for hostname: ${hostname}`);
  
  // Local development
  if (hostname === 'localhost') {
    console.log(`🔍 DEBUG: Using localhost baseUrl`);
    return 'http://localhost:5000';
  }
  
  // Replit development environment - use same domain with port 5000
  if (hostname.includes('replit.dev')) {
    const computed = `${window.location.protocol}//${hostname}`;
    console.log(`🔍 DEBUG: Using Replit baseUrl: ${computed}`);
    return computed;
  }
  
  // Production or other environments - use relative URLs
  console.log(`🔍 DEBUG: Using relative baseUrl (empty string)`);
  return '';
})();

console.log(`🌐 FINAL baseUrl: "${baseUrl}"`);

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => defaultFetcher(queryKey[0] as string),
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true, 
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time (formerly cacheTime in v4)
    },
    mutations: {
      retry: 1,
    },
  },
});

// Function to handle API responses
export async function handleApiResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return response.text();
}

// Default fetcher function for queries
export const defaultFetcher = async (url: string) => {
  const headers: HeadersInit = {};
  
  // Add auth token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${baseUrl}${url}`, { 
    headers,
    credentials: 'include' // Include cookies for auth
  });
  return handleApiResponse(response);
};

// Function for making API requests (POST, PUT, DELETE, etc)
export const apiRequest = async <T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  try {
    console.log(`🌐 apiRequest: Making ${options.method || 'GET'} request to: ${baseUrl}${url}`);
    console.log(`🌐 apiRequest: baseUrl = "${baseUrl}"`);
    console.log(`🌐 apiRequest: Full URL = "${baseUrl}${url}"`);
    console.log(`🌐 apiRequest: Options:`, options);
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    
    // Don't set Content-Type for FormData (browser will set it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Debug logging for FormData requests
    if (options.body instanceof FormData) {
      console.log('🔍 Sending FormData request to:', `${baseUrl}${url}`);
      console.log('🔍 FormData entries:');
      for (const [key, value] of options.body.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
    }
    
    let response;
    try {
      response = await fetch(`${baseUrl}${url}`, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for auth
        // Extended timeout for large file uploads
        signal: AbortSignal.timeout(600000), // 10 minutes timeout
      });
      console.log(`🌐 apiRequest: Fetch completed successfully`);
    } catch (fetchError) {
      console.error(`❌ apiRequest: Fetch failed with error:`, fetchError);
      console.error(`❌ apiRequest: Fetch error type:`, typeof fetchError);
      console.error(`❌ apiRequest: Fetch error constructor:`, (fetchError as any).constructor?.name);
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      throw new Error(`Network request failed: ${errorMessage}`);
    }
    
    console.log(`🌐 apiRequest: Response status: ${response.status}`);
    console.log(`🌐 apiRequest: Response ok: ${response.ok}`);
    console.log(`🌐 apiRequest: Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const result = await handleApiResponse(response);
    console.log(`🌐 apiRequest: Final result:`, result);
    return result;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

// Function to invalidate queries
export const invalidateQueries = (queryKey: string | string[]) => {
  const key = Array.isArray(queryKey) ? queryKey : [queryKey];
  return queryClient.invalidateQueries({ queryKey: key });
};

export default queryClient;