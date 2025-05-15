import { Deal } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getScoreColor, getStatusColor, formatDate, getInitials, getRandomColor } from "@/lib/utils";
import { Eye } from "lucide-react";

interface DealsTableProps {
  deals: Deal[];
  isLoading?: boolean;
}

export default function DealsTable({ deals, isLoading = false }: DealsTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <div className="min-w-full bg-dark-light rounded-xl overflow-hidden">
          <div className="border-b border-dark-lighter px-6 py-4">
            <div className="grid grid-cols-6 gap-4">
              <Skeleton className="h-6 w-full bg-dark-lighter" />
              <Skeleton className="h-6 w-full bg-dark-lighter" />
              <Skeleton className="h-6 w-full bg-dark-lighter" />
              <Skeleton className="h-6 w-full bg-dark-lighter" />
              <Skeleton className="h-6 w-full bg-dark-lighter" />
              <Skeleton className="h-6 w-full bg-dark-lighter" />
            </div>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-b border-dark-lighter px-6 py-4">
              <div className="grid grid-cols-6 gap-4">
                <div className="flex items-center">
                  <Skeleton className="h-10 w-10 rounded-full bg-dark-lighter mr-3" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 bg-dark-lighter" />
                    <Skeleton className="h-3 w-32 bg-dark-lighter" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16 bg-dark-lighter my-3" />
                <Skeleton className="h-4 w-16 bg-dark-lighter my-3" />
                <Skeleton className="h-6 w-16 bg-dark-lighter my-2" />
                <Skeleton className="h-6 w-24 bg-dark-lighter my-2" />
                <Skeleton className="h-4 w-12 bg-dark-lighter my-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!deals || deals.length === 0) {
    return (
      <div className="bg-dark-light rounded-xl p-8 text-center">
        <p className="text-gray-400">No deals found. Start by adding a new deal.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-dark-light rounded-xl overflow-hidden">
        <thead>
          <tr className="border-b border-dark-lighter">
            <th className="px-6 py-4 text-left text-sm font-medium">Company</th>
            <th className="px-6 py-4 text-left text-sm font-medium">Sector</th>
            <th className="px-6 py-4 text-left text-sm font-medium">Stage</th>
            <th className="px-6 py-4 text-left text-sm font-medium">AI Score</th>
            <th className="px-6 py-4 text-left text-sm font-medium">Status</th>
            <th className="px-6 py-4 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const firstLetter = deal.companyName.charAt(0);
            const bgColor = getRandomColor();
            const scoreColor = getScoreColor(deal.aiScore);
            const statusColor = getStatusColor(deal.status);

            return (
              <tr key={deal.id} className="border-b border-dark-lighter hover:bg-dark-lighter transition">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-semibold", bgColor)}>
                      {firstLetter}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium">{deal.companyName}</div>
                      <div className="text-gray-400 text-sm">{deal.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{deal.sector}</td>
                <td className="px-6 py-4 whitespace-nowrap">{deal.stage}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", scoreColor)}>
                    {deal.aiScore}/100
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={cn("px-2 inline-flex text-xs leading-5 font-semibold rounded-full", statusColor)}>
                    {deal.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a 
                    href={`/due-diligence?deal=${deal.id}`}
                    className="text-primary hover:text-primary-hover flex items-center justify-end"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    <span>View</span>
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
