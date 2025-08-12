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
      <div className="app-container">
        <Sidebar />
        <div className="main-content-container">
          <Navbar />
          <main className="main-content-area">
            <div className="content-wrapper">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}