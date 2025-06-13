import { Deal } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getScoreColor, getStatusColor, formatDate, getInitials, getRandomColor } from "@/lib/utils";
import { useLocation } from "wouter";

interface DealsTableProps {
  deals: Deal[];
  isLoading?: boolean;
}

export default function DealsTable({ deals, isLoading = false }: DealsTableProps) {
  const [, setLocation] = useLocation();
  if (isLoading) {
    return (
      <div className="w-full">
        <table className="w-full bg-dark-light rounded-xl overflow-hidden table-fixed">
          <thead>
            <tr className="border-b border-dark-lighter">
              <th className="px-4 py-4 w-2/5"><Skeleton className="h-4 w-20 bg-dark-lighter" /></th>
              <th className="px-3 py-4 w-1/6"><Skeleton className="h-4 w-16 bg-dark-lighter" /></th>
              <th className="px-3 py-4 w-1/6"><Skeleton className="h-4 w-12 bg-dark-lighter" /></th>
              <th className="px-3 py-4 w-1/6"><Skeleton className="h-4 w-16 bg-dark-lighter" /></th>
              <th className="px-4 py-4 w-1/6"><Skeleton className="h-4 w-14 bg-dark-lighter" /></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((i) => (
              <tr key={i} className="border-b border-dark-lighter">
                <td className="px-4 py-4">
                  <div className="flex items-center">
                    <Skeleton className="h-8 w-8 rounded-full bg-dark-lighter mr-3" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-24 bg-dark-lighter" />
                      <Skeleton className="h-3 w-32 bg-dark-lighter" />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4"><Skeleton className="h-4 w-16 bg-dark-lighter" /></td>
                <td className="px-3 py-4"><Skeleton className="h-4 w-14 bg-dark-lighter" /></td>
                <td className="px-3 py-4"><Skeleton className="h-6 w-12 bg-dark-lighter rounded-full" /></td>
                <td className="px-4 py-4"><Skeleton className="h-6 w-16 bg-dark-lighter rounded-full" /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="w-full">
      <table className="w-full bg-dark-light rounded-xl overflow-hidden table-fixed">
        <thead>
          <tr className="border-b border-dark-lighter">
            <th className="px-4 py-4 text-left text-sm font-medium w-2/5">Company</th>
            <th className="px-3 py-4 text-left text-sm font-medium w-1/6">Sector</th>
            <th className="px-3 py-4 text-left text-sm font-medium w-1/6">Stage</th>
            <th className="px-3 py-4 text-left text-sm font-medium w-1/6">AI Score</th>
            <th className="px-4 py-4 text-left text-sm font-medium w-1/6">Status</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const firstLetter = deal.companyName.charAt(0);
            const bgColor = getRandomColor();
            const scoreColor = getScoreColor(deal.aiScore);
            const statusColor = getStatusColor(deal.status);

            return (
              <tr 
                key={deal.id} 
                className="border-b border-dark-lighter hover:bg-dark-lighter transition cursor-pointer"
                onClick={() => setLocation(`/due-diligence?deal=${deal.id}`)}
              >
                <td className="px-4 py-4">
                  <div className="flex items-center">
                    <div className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm", bgColor)}>
                      {firstLetter}
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="font-medium text-white truncate">{deal.companyName}</div>
                      <div className="text-gray-400 text-xs truncate">{deal.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 text-sm text-gray-300 truncate">{deal.sector}</td>
                <td className="px-3 py-4 text-sm text-gray-300 truncate">{deal.stage}</td>
                <td className="px-3 py-4">
                  <div className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-medium", scoreColor)}>
                    {deal.aiScore}/100
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={cn("px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full", statusColor)}>
                    {deal.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
