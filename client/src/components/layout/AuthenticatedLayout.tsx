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
      <div className="flex h-screen overflow-hidden bg-dark text-white">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto bg-dark">
            <div className="w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}