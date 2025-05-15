import { QueryClient } from "@tanstack/react-query";

// Default baseUrl for API requests
const baseUrl = '';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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
  
  const response = await fetch(`${baseUrl}${url}`, { headers });
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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers,
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