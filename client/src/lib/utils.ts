import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function getInitials(name: string): string {
  if (!name) return '';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

export function getRandomColor(): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-orange-500',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'bg-green-900 text-green-300';
  if (score >= 70) return 'bg-yellow-900 text-yellow-300';
  return 'bg-red-900 text-red-300';
}

export function getStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    'Due Diligence': 'bg-yellow-900 text-yellow-300',
    'Screening': 'bg-blue-900 text-blue-300',
    'Memo Ready': 'bg-green-900 text-green-300',
    'New Submission': 'bg-purple-900 text-purple-300',
    'Rejected': 'bg-red-900 text-red-300',
  };
  
  return statusMap[status] || 'bg-gray-900 text-gray-300';
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
