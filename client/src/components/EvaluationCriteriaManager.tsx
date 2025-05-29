import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, 
  Percent, 
  Save, 
  RotateCcw, 
  Info,
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface EvaluationCriteria {
  id: number;
  name: string;
  description: string;
  weight: number;
  isActive: boolean;
}

export default function EvaluationCriteriaManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localCriteria, setLocalCriteria] = useState<EvaluationCriteria[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch evaluation criteria
  const { data: criteria, isLoading } = useQuery({
    queryKey: ['/api/evaluation-criteria']
  });

  // Update local criteria when data changes
  useState(() => {
    if (criteria && criteria.length > 0) {
      setLocalCriteria(criteria);
    }
  }, [criteria]);

  // Update criteria mutation
  const updateCriteria = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EvaluationCriteria> }) =>
      apiRequest(`/api/evaluation-criteria/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      toast({
        title: "Criteria Updated",
        description: "Evaluation criteria have been updated successfully.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/evaluation-criteria'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update criteria. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateWeight = (id: number, weight: number) => {
    const updated = localCriteria.map(c => 
      c.id === id ? { ...c, weight } : c
    );
    setLocalCriteria(updated);
    setHasChanges(true);
  };

  const toggleActive = (id: number) => {
    const updated = localCriteria.map(c => 
      c.id === id ? { ...c, isActive: !c.isActive } : c
    );
    setLocalCriteria(updated);
    setHasChanges(true);
  };

  const saveChanges = () => {
    localCriteria.forEach(criterion => {
      updateCriteria.mutate({ 
        id: criterion.id, 
        data: { 
          weight: criterion.weight, 
          isActive: criterion.isActive 
        } 
      });
    });
  };

  const resetToDefaults = () => {
    const defaults = [
      { id: 1, name: "Sector", description: "Must be in Healthcare", weight: 25, isActive: true },
      { id: 2, name: "Biotech Exclusion", description: "No wet-lab biotech", weight: 20, isActive: true },
      { id: 3, name: "HQ Geography", description: "EU or Israel only", weight: 15, isActive: true },
      { id: 4, name: "Stage", description: "Series A-C preferred", weight: 20, isActive: true },
      { id: 5, name: "Ownership Feasibility", description: "20-30% post-money stake possible", weight: 10, isActive: true },
      { id: 6, name: "Business Model Fit", description: "Platform logic preferred", weight: 10, isActive: true }
    ];
    setLocalCriteria(defaults);
    setHasChanges(true);
  };

  const totalWeight = localCriteria.filter(c => c.isActive).reduce((sum, c) => sum + c.weight, 0);
  const isValidWeight = totalWeight === 100;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weight Distribution Overview */}
      <Card className="bg-dark border-dark-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4" />
            Weight Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Weight</span>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${isValidWeight ? 'text-green-400' : 'text-red-400'}`}>
                  {totalWeight}%
                </span>
                {isValidWeight ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>
            <Progress 
              value={Math.min(totalWeight, 100)} 
              className="h-2"
            />
            {!isValidWeight && (
              <p className="text-xs text-red-400">
                Total weight must equal 100% for accurate scoring
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Criteria Configuration */}
      <div className="space-y-4">
        {localCriteria.map((criterion) => (
          <Card key={criterion.id} className="bg-dark border-dark-lighter">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Switch 
                      checked={criterion.isActive}
                      onCheckedChange={() => toggleActive(criterion.id)}
                    />
                    <div>
                      <h4 className="font-medium">{criterion.name}</h4>
                      <p className="text-sm text-gray-400">{criterion.description}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`weight-${criterion.id}`} className="text-sm">
                      Weight
                    </Label>
                    <div className="flex items-center gap-1">
                      <Input
                        id={`weight-${criterion.id}`}
                        type="number"
                        min="0"
                        max="100"
                        value={criterion.weight}
                        onChange={(e) => updateWeight(criterion.id, parseInt(e.target.value) || 0)}
                        className="w-16 h-8 text-center bg-dark-lighter border-dark-lighter"
                        disabled={!criterion.isActive}
                      />
                      <Percent className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                  
                  <Badge 
                    variant={criterion.isActive ? "default" : "secondary"}
                    className={criterion.isActive ? "bg-primary/20 text-primary" : ""}
                  >
                    {criterion.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={resetToDefaults}
          className="border-dark-lighter hover:bg-dark-lighter"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <div className="flex items-center gap-3">
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <Info className="w-4 h-4" />
              Unsaved changes
            </div>
          )}
          <Button
            onClick={saveChanges}
            disabled={!hasChanges || !isValidWeight || updateCriteria.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateCriteria.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium text-blue-400">How AI Evaluation Works</h4>
              <p className="text-sm text-blue-300">
                When a deal is submitted with a website URL, our AI analyzes the company against these criteria. 
                Each criterion is scored 0-100, then combined using your configured weights to generate an overall score.
              </p>
              <p className="text-sm text-blue-300 mt-2">
                <strong>Scoring Guidelines:</strong> 80-100 = PASS, 50-79 = INVESTIGATE, 0-49 = REJECT
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}