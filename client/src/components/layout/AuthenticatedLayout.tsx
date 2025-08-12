import { ReactNode } from 'react';
import { SidebarProvider } from '@/contexts/SidebarContext';
import Navbar from "./navbar";
import Sidebar from "./sidebar";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50" style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'rgb(248, 250, 252)',
        color: 'rgb(17, 24, 39)'
      }}>
        <Sidebar />
        <div className="main-content flex flex-col flex-1 overflow-hidden min-w-0" style={{
          marginLeft: '4rem',
          display: 'flex',
          flexDirection: 'column',
          flex: '1',
          overflow: 'hidden',
          minWidth: '0'
        }}>
          <Navbar />
          <main className="flex-1 overflow-y-auto bg-gray-50" style={{
            flex: '1',
            overflowY: 'auto',
            backgroundColor: 'rgb(248, 250, 252)',
            minHeight: '100vh',
            padding: '1.5rem'
          }}>
            <div className="w-full min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}