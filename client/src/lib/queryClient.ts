import { QueryClient } from "@tanstack/react-query";

// Default baseUrl for API requests
// 🚨 CRITICAL FIX: Dynamic baseUrl to bypass Vite in development
const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' // Development: bypass Vite middleware
  : ''; // Production: use relative URLs

console.log(`🔍 API Base URL: ${baseUrl || 'relative URLs'}, hostname: ${typeof window !== 'undefined' ? window.location.hostname : 'N/A'}`);
console.log(`🔍 Environment: ${typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'DEVELOPMENT' : 'PRODUCTION'}`);
console.log(`🔍 Full location:`, typeof window !== 'undefined' ? window.location.href : 'N/A');

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => defaultFetcher(queryKey[0] as string),
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Function to handle API responses
export async function handleApiResponse(response: Response) {
  console.log(`🔍 API Response: ${response.status} ${response.statusText} for ${response.url}`);
  console.log(`🔍 Content-Type: ${response.headers.get('content-type')}`);
  
  if (!response.ok) {
    // Check if response is HTML (error page)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const htmlText = await response.text();
      console.error('🚨 PRODUCTION ERROR: Received HTML instead of JSON:', htmlText.substring(0, 200));
      throw new Error(`Production API error: ${response.status} - Server returned HTML error page instead of JSON. This indicates the API route is not found or server crashed.`);
    }
    
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
      console.log('🔍 PRODUCTION DEBUG: Sending FormData request to:', `${baseUrl}${url}`);
      console.log('🔍 Full URL will be:', `${baseUrl}${url}`);
      console.log('🔍 Current origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
      console.log('🔍 FormData entries:');
      for (const [key, value] of options.body.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
    }
    
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for auth
      // Extended timeout for large file uploads
      signal: AbortSignal.timeout(600000), // 10 minutes timeout
    });
    
    return handleApiResponse(response);
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