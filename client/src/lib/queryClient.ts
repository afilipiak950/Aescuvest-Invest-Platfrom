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
  const response = await fetch(`${baseUrl}${url}`);
  return handleApiResponse(response);
};

// Function for making API requests (POST, PUT, DELETE, etc)
export const apiRequest = async (
  url: string,
  options: RequestInit = {}
) => {
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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