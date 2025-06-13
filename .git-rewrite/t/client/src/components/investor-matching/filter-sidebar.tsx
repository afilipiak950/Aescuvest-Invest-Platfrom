import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Deal } from "@/types";
import { Loader2 } from "lucide-react";

interface FilterSidebarProps {
  deals: Deal[];
  selectedDeal: string;
  onDealChange: (dealId: string) => void;
  isLoading?: boolean;
}

const investorTypes = [
  { id: "vc", label: "Venture Capital", defaultChecked: true },
  { id: "corporate", label: "Corporate Venture", defaultChecked: true },
  { id: "angel", label: "Angel Investors", defaultChecked: false },
  { id: "familyoffice", label: "Family Offices", defaultChecked: true },
];

const investmentStages = [
  { id: "seed", label: "Seed", defaultChecked: false },
  { id: "seriesa", label: "Series A", defaultChecked: true },
  { id: "seriesb", label: "Series B", defaultChecked: true },
  { id: "growth", label: "Growth", defaultChecked: false },
];

const geographyRegions = [
  { id: "dach", label: "DACH Region", defaultChecked: true },
  { id: "uk", label: "UK", defaultChecked: true },
  { id: "nordics", label: "Nordics", defaultChecked: true },
];

export default function FilterSidebar({
  deals,
  selectedDeal,
  onDealChange,
  isLoading = false,
}: FilterSidebarProps) {
  const [investorTypeFilters, setInvestorTypeFilters] = useState<string[]>(
    investorTypes.filter(t => t.defaultChecked).map(t => t.id)
  );
  
  const [stageFilters, setStageFilters] = useState<string[]>(
    investmentStages.filter(s => s.defaultChecked).map(s => s.id)
  );
  
  const [geography, setGeography] = useState("Europe");
  
  const [regionFilters, setRegionFilters] = useState<string[]>(
    geographyRegions.filter(r => r.defaultChecked).map(r => r.id)
  );
  
  const [checkSize, setCheckSize] = useState("€2M - €5M");
  
  const handleTypeToggle = (typeId: string) => {
    setInvestorTypeFilters(prev => {
      if (prev.includes(typeId)) {
        return prev.filter(id => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };
  
  const handleStageToggle = (stageId: string) => {
    setStageFilters(prev => {
      if (prev.includes(stageId)) {
        return prev.filter(id => id !== stageId);
      } else {
        return [...prev, stageId];
      }
    });
  };
  
  const handleRegionToggle = (regionId: string) => {
    setRegionFilters(prev => {
      if (prev.includes(regionId)) {
        return prev.filter(id => id !== regionId);
      } else {
        return [...prev, regionId];
      }
    });
  };
  
  const updateMatches = () => {
    // In a real app, this would trigger a refetch of investors with the selected filters
    console.log("Updating matches with filters:", {
      dealId: selectedDeal,
      investorTypes: investorTypeFilters,
      stages: stageFilters,
      geography,
      regions: regionFilters,
      checkSize,
    });
  };
  
  if (isLoading) {
    return (
      <Card className="bg-dark-light border-dark-lighter sticky top-24">
        <CardContent className="p-6">
          <Skeleton className="h-6 w-40 mb-3 bg-dark-lighter" />
          <Skeleton className="h-10 w-full mb-6 bg-dark-lighter" />
          
          <Skeleton className="h-6 w-32 mb-3 bg-dark-lighter" />
          <div className="space-y-2 mb-6">
            <Skeleton className="h-5 w-full bg-dark-lighter" />
            <Skeleton className="h-5 w-full bg-dark-lighter" />
            <Skeleton className="h-5 w-full bg-dark-lighter" />
          </div>
          
          <Skeleton className="h-6 w-40 mb-3 bg-dark-lighter" />
          <div className="space-y-2 mb-6">
            <Skeleton className="h-5 w-full bg-dark-lighter" />
            <Skeleton className="h-5 w-full bg-dark-lighter" />
            <Skeleton className="h-5 w-full bg-dark-lighter" />
          </div>
          
          <Skeleton className="h-6 w-24 mb-3 bg-dark-lighter" />
          <Skeleton className="h-10 w-full mb-3 bg-dark-lighter" />
          <div className="space-y-2 mb-6">
            <Skeleton className="h-5 w-full bg-dark-lighter" />
            <Skeleton className="h-5 w-full bg-dark-lighter" />
          </div>
          
          <Skeleton className="h-6 w-24 mb-3 bg-dark-lighter" />
          <Skeleton className="h-10 w-full mb-6 bg-dark-lighter" />
          
          <Skeleton className="h-10 w-full bg-dark-lighter" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-dark-light border-dark-lighter sticky top-24">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Select Deal
            </Label>
            <Select 
              value={selectedDeal} 
              onValueChange={onDealChange}
            >
              <SelectTrigger className="w-full bg-dark-lighter border-dark-lighter focus:ring-primary">
                <SelectValue placeholder="Select a deal" />
              </SelectTrigger>
              <SelectContent className="bg-dark-lighter border-dark-lighter">
                {deals.map(deal => (
                  <SelectItem key={deal.id} value={deal.id.toString()}>
                    {deal.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Investor Type
            </Label>
            <div className="space-y-2">
              {investorTypes.map((type) => (
                <div className="flex items-center" key={type.id}>
                  <Checkbox 
                    id={type.id} 
                    checked={investorTypeFilters.includes(type.id)}
                    onCheckedChange={() => handleTypeToggle(type.id)}
                    className="mr-2 h-4 w-4 data-[state=checked]:bg-primary"
                  />
                  <Label htmlFor={type.id} className="text-sm">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Investment Stage
            </Label>
            <div className="space-y-2">
              {investmentStages.map((stage) => (
                <div className="flex items-center" key={stage.id}>
                  <Checkbox 
                    id={stage.id} 
                    checked={stageFilters.includes(stage.id)}
                    onCheckedChange={() => handleStageToggle(stage.id)}
                    className="mr-2 h-4 w-4 data-[state=checked]:bg-primary"
                  />
                  <Label htmlFor={stage.id} className="text-sm">
                    {stage.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Geography
            </Label>
            <Select 
              value={geography} 
              onValueChange={setGeography}
            >
              <SelectTrigger className="w-full bg-dark-lighter border-dark-lighter focus:ring-primary mb-2">
                <SelectValue placeholder="Select geography" />
              </SelectTrigger>
              <SelectContent className="bg-dark-lighter border-dark-lighter">
                <SelectItem value="Europe">Europe</SelectItem>
                <SelectItem value="North America">North America</SelectItem>
                <SelectItem value="Asia">Asia</SelectItem>
                <SelectItem value="Global">Global</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="space-y-2">
              {geographyRegions.map((region) => (
                <div className="flex items-center" key={region.id}>
                  <Checkbox 
                    id={region.id} 
                    checked={regionFilters.includes(region.id)}
                    onCheckedChange={() => handleRegionToggle(region.id)}
                    className="mr-2 h-4 w-4 data-[state=checked]:bg-primary"
                  />
                  <Label htmlFor={region.id} className="text-sm">
                    {region.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Check Size
            </Label>
            <Select 
              value={checkSize} 
              onValueChange={setCheckSize}
            >
              <SelectTrigger className="w-full bg-dark-lighter border-dark-lighter focus:ring-primary">
                <SelectValue placeholder="Select check size" />
              </SelectTrigger>
              <SelectContent className="bg-dark-lighter border-dark-lighter">
                <SelectItem value="€500K - €2M">€500K - €2M</SelectItem>
                <SelectItem value="€2M - €5M">€2M - €5M</SelectItem>
                <SelectItem value="€5M - €10M">€5M - €10M</SelectItem>
                <SelectItem value="€10M+">€10M+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="pt-4">
            <Button 
              onClick={updateMatches}
              className="w-full bg-primary hover:bg-primary-hover text-dark font-medium"
            >
              Update Matches
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
