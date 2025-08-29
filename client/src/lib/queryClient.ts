import { QueryClient } from "@tanstack/react-query";

// Default baseUrl for API requests
const baseUrl = '';

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
      console.log('🔍 Sending FormData request to:', url);
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