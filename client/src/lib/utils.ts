import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return 'Unknown date';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(name: string): string {
  if (!name) return '';
  
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-primary border-primary';
  if (score >= 70) return 'text-blue-500 border-blue-500';
  if (score >= 50) return 'text-amber-500 border-amber-500';
  return 'text-red-500 border-red-500';
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes';
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return kilobytes.toFixed(1) + ' KB';
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return megabytes.toFixed(1) + ' MB';
  const gigabytes = megabytes / 1024;
  return gigabytes.toFixed(1) + ' GB';
}

// Get status color for UI elements
export function getStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    'Complete': 'bg-green-500',
    'In Progress': 'bg-blue-500',
    'Pending': 'bg-amber-500',
    'Failed': 'bg-red-500',
    'Active': 'bg-green-500',
    'Inactive': 'bg-gray-400',
    'New': 'bg-purple-500',
    'Analyzing': 'bg-blue-500',
    'Analyzed': 'bg-green-500',
    'High': 'bg-red-500',
    'Medium': 'bg-amber-500',
    'Low': 'bg-green-500',
  };
  
  return statusMap[status] || 'bg-gray-400';
}

// Generate random ID for UI elements
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Generate random color for UI elements
export function getRandomColor(): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-red-500',
    'bg-teal-500',
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}