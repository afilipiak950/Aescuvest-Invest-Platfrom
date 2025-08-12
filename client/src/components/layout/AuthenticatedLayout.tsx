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
      <div className="flex h-screen overflow-hidden bg-dark text-white" style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'rgb(15, 23, 42)',
        color: 'white'
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
          <main className="flex-1 overflow-y-auto bg-dark" style={{
            flex: '1',
            overflowY: 'auto',
            backgroundColor: 'rgb(17, 24, 39)',
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