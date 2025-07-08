import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Filter, X } from 'lucide-react';

interface Deal {
  id: number;
  companyName: string;
  sector: string;
  stage: string;
  location: string;
  fundingAmount: number;
}

interface FilterSidebarProps {
  deals: Deal[];
  selectedDeal: string;
  onDealChange: (dealId: string) => void;
  isLoading: boolean;
}

export default function FilterSidebar({ deals, selectedDeal, onDealChange, isLoading }: FilterSidebarProps) {
  const [filters, setFilters] = useState({
    sectors: [] as string[],
    stages: [] as string[],
    locations: [] as string[],
    checkSizeRange: [0, 50] as [number, number],
    verified: false,
    tier: 'all'
  });

  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);

  const sectorOptions = [
    'HealthTech', 'MedTech', 'Neurotechnology', 'BCI', 'Medical Devices',
    'Digital Health', 'Life Sciences', 'Biotech', 'Pharma', 'AI/ML',
    'SaaS', 'FinTech', 'InsurTech', 'RegTech', 'Enterprise Software',
    'Consumer', 'E-commerce', 'Mobility', 'CleanTech', 'Energy'
  ];

  const stageOptions = [
    'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+',
    'Growth', 'Private Equity', 'Venture Debt', 'Bridge'
  ];

  const locationOptions = [
    'Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany', 'Frankfurt, Germany',
    'London, UK', 'Cambridge, UK', 'Edinburgh, UK', 'Manchester, UK',
    'Zurich, Switzerland', 'Geneva, Switzerland', 'Basel, Switzerland',
    'Paris, France', 'Lyon, France', 'Amsterdam, Netherlands',
    'Stockholm, Sweden', 'Copenhagen, Denmark', 'Oslo, Norway',
    'Helsinki, Finland', 'Dublin, Ireland', 'Vienna, Austria',
    'Milan, Italy', 'Barcelona, Spain', 'Madrid, Spain',
    'Tel Aviv, Israel', 'New York, USA', 'San Francisco, USA',
    'Boston, USA', 'Toronto, Canada', 'Singapore'
  ];

  const handleSectorChange = (sector: string) => {
    setFilters(prev => ({
      ...prev,
      sectors: prev.sectors.includes(sector) 
        ? prev.sectors.filter(s => s !== sector)
        : [...prev.sectors, sector]
    }));
  };

  const handleStageChange = (stage: string) => {
    setFilters(prev => ({
      ...prev,
      stages: prev.stages.includes(stage) 
        ? prev.stages.filter(s => s !== stage)
        : [...prev.stages, stage]
    }));
  };

  const handleLocationChange = (location: string) => {
    setFilters(prev => ({
      ...prev,
      locations: prev.locations.includes(location) 
        ? prev.locations.filter(l => l !== location)
        : [...prev.locations, location]
    }));
  };

  const applyFilters = () => {
    const filterLabels = [];
    
    if (filters.sectors.length > 0) {
      filterLabels.push(`Sectors: ${filters.sectors.join(', ')}`);
    }
    if (filters.stages.length > 0) {
      filterLabels.push(`Stages: ${filters.stages.join(', ')}`);
    }
    if (filters.locations.length > 0) {
      filterLabels.push(`Locations: ${filters.locations.join(', ')}`);
    }
    if (filters.checkSizeRange[0] > 0 || filters.checkSizeRange[1] < 50) {
      filterLabels.push(`Check Size: €${filters.checkSizeRange[0]}M - €${filters.checkSizeRange[1]}M`);
    }
    if (filters.verified) {
      filterLabels.push('Verified Only');
    }
    if (filters.tier !== 'all') {
      filterLabels.push(`Tier: ${filters.tier}`);
    }
    
    setAppliedFilters(filterLabels);
  };

  const clearFilters = () => {
    setFilters({
      sectors: [],
      stages: [],
      locations: [],
      checkSizeRange: [0, 50],
      verified: false,
      tier: 'all'
    });
    setAppliedFilters([]);
  };

  const removeFilter = (filterToRemove: string) => {
    setAppliedFilters(prev => prev.filter(f => f !== filterToRemove));
  };

  const currentDeal = deals.find(d => d.id.toString() === selectedDeal);

  return (
    <div className="space-y-6">
      {/* Deal Selection */}
      <Card className="bg-dark-light border-dark-lighter">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Select Deal</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedDeal} onValueChange={onDealChange} disabled={isLoading}>
            <SelectTrigger className="bg-dark-lighter border-dark-lighter text-white">
              <SelectValue placeholder="Choose a deal" />
            </SelectTrigger>
            <SelectContent className="bg-dark-lighter border-dark-lighter">
              {deals.map(deal => (
                <SelectItem key={deal.id} value={deal.id.toString()}>
                  <div className="flex flex-col">
                    <span className="font-medium">{deal.companyName}</span>
                    <span className="text-xs text-gray-400">
                      {deal.sector} • {deal.stage} • €{deal.fundingAmount.toLocaleString()}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {currentDeal && (
            <div className="mt-4 p-3 bg-dark-lighter rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Company:</span>
                  <span className="text-sm text-gray-300">{currentDeal.companyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sector:</span>
                  <Badge variant="outline" className="text-xs">{currentDeal.sector}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stage:</span>
                  <Badge variant="outline" className="text-xs">{currentDeal.stage}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Location:</span>
                  <span className="text-sm text-gray-300">{currentDeal.location}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Funding:</span>
                  <span className="text-sm text-gray-300">€{currentDeal.fundingAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-dark-light border-dark-lighter">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Investor Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sectors */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Focus Areas</Label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {sectorOptions.map(sector => (
                <div key={sector} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sector-${sector}`}
                    checked={filters.sectors.includes(sector)}
                    onCheckedChange={() => handleSectorChange(sector)}
                    className="border-gray-600"
                  />
                  <Label htmlFor={`sector-${sector}`} className="text-sm text-gray-300">
                    {sector}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Investment Stages */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Investment Stages</Label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {stageOptions.map(stage => (
                <div key={stage} className="flex items-center space-x-2">
                  <Checkbox
                    id={`stage-${stage}`}
                    checked={filters.stages.includes(stage)}
                    onCheckedChange={() => handleStageChange(stage)}
                    className="border-gray-600"
                  />
                  <Label htmlFor={`stage-${stage}`} className="text-sm text-gray-300">
                    {stage}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Locations */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Locations</Label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {locationOptions.map(location => (
                <div key={location} className="flex items-center space-x-2">
                  <Checkbox
                    id={`location-${location}`}
                    checked={filters.locations.includes(location)}
                    onCheckedChange={() => handleLocationChange(location)}
                    className="border-gray-600"
                  />
                  <Label htmlFor={`location-${location}`} className="text-sm text-gray-300">
                    {location}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Check Size Range */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Check Size Range: €{filters.checkSizeRange[0]}M - €{filters.checkSizeRange[1]}M
            </Label>
            <Slider
              value={filters.checkSizeRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, checkSizeRange: value as [number, number] }))}
              max={50}
              min={0}
              step={1}
              className="my-4"
            />
          </div>

          {/* Verified Only */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="verified"
              checked={filters.verified}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, verified: checked as boolean }))}
              className="border-gray-600"
            />
            <Label htmlFor="verified" className="text-sm text-gray-300">
              Verified investors only
            </Label>
          </div>

          {/* Tier */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Investor Tier</Label>
            <Select value={filters.tier} onValueChange={(value) => setFilters(prev => ({ ...prev, tier: value }))}>
              <SelectTrigger className="bg-dark-lighter border-dark-lighter text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-dark-lighter border-dark-lighter">
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={applyFilters}
              className="flex-1 bg-primary hover:bg-primary-hover text-dark font-medium"
              size="sm"
            >
              Apply Filters
            </Button>
            <Button
              onClick={clearFilters}
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300 hover:bg-dark-lighter"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Applied Filters */}
      {appliedFilters.length > 0 && (
        <Card className="bg-dark-light border-dark-lighter">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Applied Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {appliedFilters.map((filter, index) => (
                <div key={index} className="flex items-center justify-between bg-dark-lighter rounded-lg p-2">
                  <span className="text-sm text-gray-300">{filter}</span>
                  <Button
                    onClick={() => removeFilter(filter)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}