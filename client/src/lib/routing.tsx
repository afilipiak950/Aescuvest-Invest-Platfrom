import { Link } from 'wouter';

export { Link };

// Route definitions for easy maintenance
export const routes = {
  dashboard: '/',
  deals: '/deals',
  deal: (id: string | number) => `/deals/${id}`,
  documents: '/documents',
  analyses: '/analyses',
  investors: '/investors',
  settings: '/settings',
  automations: '/automations',
  workflow: '/workflow',
  inbox: '/inbox',
  dealIntake: '/deal-intake'
} as const;

// Navigation helper
export const navigate = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};