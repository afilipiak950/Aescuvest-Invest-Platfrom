import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, Check } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { insertDealSchema } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

const dealFormSchema = insertDealSchema.extend({
  fundingAmount: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (typeof val === 'string' && val) {
      return parseFloat(val.replace(/[^0-9.]/g, ''));
    }
    return typeof val === 'number' ? val : undefined;
  }),
  location: z.string().nullable().optional(),
});

type DealFormValues = z.infer<typeof dealFormSchema>;

const sectors = [
  'HealthTech',
  'MedTech', 
  'BioTech',
  'Digital Health',
  'Pharmaceuticals',
  'Medical Devices',
  'Telemedicine',
  'AI in Healthcare',
  'Diagnostics',
  'Therapeutics',
];

const stages = [
  'Pre-Seed',
  'Seed',
  'Series A',
  'Series B', 
  'Series C',
  'Series D+',
  'Growth',
  'Pre-IPO',
];

const locations = [
  'Berlin, Germany',
  'Munich, Germany',
  'Hamburg, Germany',
  'Frankfurt, Germany',
  'Cologne, Germany',
  'Vienna, Austria',
  'Zurich, Switzerland',
  'London, UK',
  'Paris, France',
  'Amsterdam, Netherlands',
];

export default function DealForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      companyName: '',
      description: '',
      sector: '',
      stage: '',
      location: '',
      fundingAmount: undefined,
      status: 'Screening',
    },
  });

  const createDealMutation = useMutation({
    mutationFn: (data: DealFormValues) => apiRequest('/api/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({
        title: 'Deal erfolgreich erstellt!',
        description: 'Das neue Deal wurde im System angelegt.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      form.reset();
      setIsSubmitted(true);
      setTimeout(() => setIsSubmitted(false), 3000);
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message || 'Das Deal konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DealFormValues) => {
    createDealMutation.mutate(data);
  };

  if (isSubmitted) {
    return (
      <Card className="bg-green-500/10 border-green-500/30">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4">
              <Check className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Deal erfolgreich erstellt!</h3>
            <p className="text-gray-400 mb-4">Das neue Deal wurde im System angelegt und kann jetzt bearbeitet werden.</p>
            <Button 
              onClick={() => setIsSubmitted(false)}
              className="bg-primary hover:bg-primary-hover"
            >
              Weiteren Deal anlegen
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Name */}
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Unternehmensname *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="z.B. NeuroTech AI"
                    className="bg-dark border-dark-lighter focus:ring-primary text-white"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sector */}
          <FormField
            control={form.control}
            name="sector"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Sektor *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-dark border-dark-lighter focus:ring-primary text-white">
                      <SelectValue placeholder="Wähle einen Sektor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-dark-lighter border-dark-lighter">
                    {sectors.map((sector) => (
                      <SelectItem key={sector} value={sector} className="text-white">
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Stage */}
          <FormField
            control={form.control}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Finanzierungsrunde *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-dark border-dark-lighter focus:ring-primary text-white">
                      <SelectValue placeholder="Wähle eine Runde" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-dark-lighter border-dark-lighter">
                    {stages.map((stage) => (
                      <SelectItem key={stage} value={stage} className="text-white">
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Standort</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className="bg-dark border-dark-lighter focus:ring-primary text-white">
                      <SelectValue placeholder="Wähle einen Standort" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-dark-lighter border-dark-lighter">
                    {locations.map((location) => (
                      <SelectItem key={location} value={location} className="text-white">
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Beschreibung *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Kurze Beschreibung des Unternehmens und der Technologie..."
                  className="bg-dark border-dark-lighter focus:ring-primary text-white min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Funding Amount */}
        <FormField
          control={form.control}
          name="fundingAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Finanzierungsvolumen (EUR)</FormLabel>
              <FormControl>
                <Input
                  placeholder="z.B. 5000000"
                  type="text"
                  className="bg-dark border-dark-lighter focus:ring-primary text-white"
                  {...field}
                  onChange={(e) => {
                    // Format number with commas
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    const formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    field.onChange(formatted);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={createDealMutation.isPending}
            className="bg-primary hover:bg-primary-hover text-white px-8"
          >
            {createDealMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deal wird erstellt...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Deal erstellen
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}