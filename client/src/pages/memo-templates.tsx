import { Link } from 'wouter';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Eye, Download } from 'lucide-react';

interface MemoTemplate {
  id: number;
  name: string;
  description: string;
  category: 'Healthcare' | 'Technology' | 'Energy' | 'Finance' | 'General';
  sections: number;
  lastUpdated: string;
  usageCount: number;
}

export default function MemoTemplates() {
  // Mock templates data
  const templates: MemoTemplate[] = [
    {
      id: 1,
      name: 'Healthcare Technology Investment Memo',
      description: 'Comprehensive template for healthcare and medical technology investments including regulatory considerations.',
      category: 'Healthcare',
      sections: 12,
      lastUpdated: '2025-08-15',
      usageCount: 15
    },
    {
      id: 2,
      name: 'SaaS Technology Investment Memo',
      description: 'Template focused on software-as-a-service companies with emphasis on metrics and scalability.',
      category: 'Technology',
      sections: 10,
      lastUpdated: '2025-08-10',
      usageCount: 23
    },
    {
      id: 3,
      name: 'Clean Energy Investment Memo',
      description: 'Template for renewable energy and clean technology investments with ESG considerations.',
      category: 'Energy',
      sections: 11,
      lastUpdated: '2025-08-05',
      usageCount: 8
    },
    {
      id: 4,
      name: 'FinTech Investment Memo',
      description: 'Template for financial technology companies with regulatory and compliance focus.',
      category: 'Finance',
      sections: 13,
      lastUpdated: '2025-07-28',
      usageCount: 12
    },
    {
      id: 5,
      name: 'Standard Investment Memo',
      description: 'General purpose investment memo template suitable for most industries.',
      category: 'General',
      sections: 9,
      lastUpdated: '2025-08-20',
      usageCount: 31
    }
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Healthcare': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Technology': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Energy': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Finance': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'General': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Memo Templates" 
        description="Pre-built investment memo templates for different industries and use cases"
        actions={[
          { label: 'Create Template', icon: 'Plus', href: '/memo-generator?template=new', variant: 'default' }
        ]}
      />

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="bg-dark-light border-dark-lighter hover:bg-dark-lighter/50 transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between mb-2">
                <Badge variant="outline" className={getCategoryColor(template.category)}>
                  {template.category}
                </Badge>
                <span className="text-xs text-gray-400">
                  Used {template.usageCount} times
                </span>
              </div>
              <CardTitle className="text-lg font-semibold text-white mb-1">
                {template.name}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-0">
              <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                {template.description}
              </p>
              
              <div className="flex items-center justify-between mb-4 text-xs text-gray-400">
                <span>{template.sections} sections</span>
                <span>Updated {new Date(template.lastUpdated).toLocaleDateString()}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="flex-1">
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Link href={`/memo-generator?template=${template.id}`}>
                  <Button variant="ghost" size="sm" className="flex-1">
                    <Plus className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                </Link>
                <Button variant="ghost" size="sm">
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State for Custom Templates */}
      <div className="mt-12 text-center py-8 border-t border-dark-lighter">
        <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">Custom Templates</h3>
        <p className="text-gray-500 mb-4">
          Create your own custom memo templates for specific investment criteria.
        </p>
        <Link href="/memo-generator?template=new">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Custom Template
          </Button>
        </Link>
      </div>
    </div>
  );
}