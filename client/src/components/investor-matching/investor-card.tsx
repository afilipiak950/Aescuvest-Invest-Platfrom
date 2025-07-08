import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  ExternalLink,
  Mail,
  Phone,
  Calendar,
  Star
} from 'lucide-react';

interface InvestorCardProps {
  investor: {
    id: number;
    name: string;
    firmName?: string;
    location: string;
    focus: string[];
    stages: string[];
    checkSize?: string;
    checkSizeMin?: number;
    checkSizeMax?: number;
    matchScore: number;
    portfolio: string[];
    matchInsights?: {
      strengths?: string[];
      concerns?: string[];
      recommendations?: string[];
    };
    matchReason?: string[];
    sectorFit?: number;
    stageFit?: number;
    geographyFit?: number;
    checkSizeFit?: number;
    thesisFit?: number;
    status?: string;
    outreachStatus?: string;
    contactEmail?: string;
    contactPerson?: string;
    contactTitle?: string;
    website?: string;
    linkedinUrl?: string;
    verified?: boolean;
    tier?: string;
    responseRate?: number;
    averageResponseTime?: number;
    notes?: string;
    lastContactDate?: string;
    nextFollowUpDate?: string;
  };
}

export default function InvestorCard({ investor }: InvestorCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [localNotes, setLocalNotes] = useState(investor.notes || '');
  const [localStatus, setLocalStatus] = useState(investor.status || 'potential');
  const [localOutreachStatus, setLocalOutreachStatus] = useState(investor.outreachStatus || 'not_contacted');

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-blue-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getMatchScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'interested': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'contacted': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'declined': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'invested': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getOutreachStatusColor = (status: string) => {
    switch (status) {
      case 'email_sent': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'meeting_scheduled': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'follow_up': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'closed': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const formatCheckSize = () => {
    if (investor.checkSizeMin && investor.checkSizeMax) {
      return `€${investor.checkSizeMin.toLocaleString()} - €${investor.checkSizeMax.toLocaleString()}`;
    }
    return investor.checkSize || 'N/A';
  };

  const handleUpdateInvestor = async () => {
    setIsUpdating(true);
    try {
      // Simulate API call to update investor
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Updated investor:', {
        id: investor.id,
        status: localStatus,
        outreachStatus: localOutreachStatus,
        notes: localNotes
      });
      setShowDetails(false);
    } catch (error) {
      console.error('Failed to update investor:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleScheduleMeeting = () => {
    // Simulate scheduling a meeting
    console.log('Scheduling meeting with:', investor.name);
    setLocalOutreachStatus('meeting_scheduled');
  };

  const handleSendEmail = () => {
    // Simulate sending email
    console.log('Sending email to:', investor.contactEmail);
    setLocalOutreachStatus('email_sent');
  };

  return (
    <Card className="bg-dark-light border-dark-lighter hover:border-primary/50 transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg font-semibold text-white">
                {investor.name}
              </CardTitle>
              {investor.verified && (
                <CheckCircle className="h-4 w-4 text-green-400" />
              )}
              {investor.tier && (
                <Badge variant="outline" className="text-xs">
                  {investor.tier}
                </Badge>
              )}
            </div>
            
            {investor.firmName && (
              <p className="text-sm text-gray-400 mb-1">{investor.firmName}</p>
            )}
            
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{investor.location}</span>
              </div>
              
              {investor.responseRate && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{investor.responseRate}% response rate</span>
                </div>
              )}
              
              {investor.averageResponseTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{investor.averageResponseTime}h avg response</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-2xl font-bold ${getMatchScoreColor(investor.matchScore)}`}>
              {investor.matchScore}%
            </div>
            <div className="text-xs text-gray-400">
              {getMatchScoreLabel(investor.matchScore)}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={getStatusColor(localStatus)}>
            {localStatus.replace('_', ' ')}
          </Badge>
          <Badge className={getOutreachStatusColor(localOutreachStatus)}>
            {localOutreachStatus.replace('_', ' ')}
          </Badge>
        </div>

        {/* Investment Focus */}
        <div>
          <h4 className="text-sm font-medium mb-2">Investment Focus</h4>
          <div className="flex flex-wrap gap-1">
            {investor.focus.slice(0, 3).map(area => (
              <Badge key={area} variant="secondary" className="text-xs">
                {area}
              </Badge>
            ))}
            {investor.focus.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{investor.focus.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Investment Stages */}
        <div>
          <h4 className="text-sm font-medium mb-2">Investment Stages</h4>
          <div className="flex flex-wrap gap-1">
            {investor.stages.map(stage => (
              <Badge key={stage} variant="outline" className="text-xs">
                {stage}
              </Badge>
            ))}
          </div>
        </div>

        {/* Check Size */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Check Size:</span>
          <span className="text-sm text-gray-300">{formatCheckSize()}</span>
        </div>

        {/* Fit Scores */}
        {investor.sectorFit && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Fit Analysis</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Sector Fit</span>
                <span>{investor.sectorFit}%</span>
              </div>
              <Progress value={investor.sectorFit} className="h-1" />
              
              <div className="flex justify-between text-xs">
                <span>Stage Fit</span>
                <span>{investor.stageFit}%</span>
              </div>
              <Progress value={investor.stageFit} className="h-1" />
              
              <div className="flex justify-between text-xs">
                <span>Geography Fit</span>
                <span>{investor.geographyFit}%</span>
              </div>
              <Progress value={investor.geographyFit} className="h-1" />
            </div>
          </div>
        )}

        {/* Top Match Reasons */}
        {investor.matchReason && investor.matchReason.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Why This Match?</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              {investor.matchReason.slice(0, 2).map((reason, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Star className="h-3 w-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Portfolio Companies */}
        {investor.portfolio.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Portfolio Companies</h4>
            <div className="flex flex-wrap gap-1">
              {investor.portfolio.slice(0, 3).map(company => (
                <Badge key={company} variant="secondary" className="text-xs">
                  {company}
                </Badge>
              ))}
              {investor.portfolio.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{investor.portfolio.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSendEmail}
            size="sm"
            className="flex-1 bg-primary hover:bg-primary-hover text-dark font-medium"
            disabled={localOutreachStatus === 'email_sent'}
          >
            <Mail className="h-4 w-4 mr-2" />
            {localOutreachStatus === 'email_sent' ? 'Email Sent' : 'Send Email'}
          </Button>
          
          <Button
            onClick={handleScheduleMeeting}
            size="sm"
            variant="outline"
            className="flex-1 border-gray-600 text-gray-300 hover:bg-dark-lighter"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
          
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-dark-lighter">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-dark-light border-dark-lighter max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {investor.name} - Detailed View
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Contact Information */}
                <div>
                  <h4 className="font-medium mb-3">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Contact Person:</span>
                      <p className="text-white">{investor.contactPerson || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Title:</span>
                      <p className="text-white">{investor.contactTitle || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Email:</span>
                      <p className="text-white">{investor.contactEmail || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Website:</span>
                      {investor.website ? (
                        <a 
                          href={investor.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary-hover flex items-center gap-1"
                        >
                          Visit <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="text-white">N/A</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Match Insights */}
                {investor.matchInsights && (
                  <div>
                    <h4 className="font-medium mb-3">AI Match Analysis</h4>
                    <div className="space-y-3">
                      {investor.matchInsights.strengths && (
                        <div>
                          <h5 className="text-sm font-medium text-green-400 mb-1">Strengths</h5>
                          <ul className="text-sm text-gray-300 space-y-1">
                            {investor.matchInsights.strengths.map((strength, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                                <span>{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {investor.matchInsights.concerns && (
                        <div>
                          <h5 className="text-sm font-medium text-yellow-400 mb-1">Concerns</h5>
                          <ul className="text-sm text-gray-300 space-y-1">
                            {investor.matchInsights.concerns.map((concern, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <XCircle className="h-3 w-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <span>{concern}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {investor.matchInsights.recommendations && (
                        <div>
                          <h5 className="text-sm font-medium text-blue-400 mb-1">Recommendations</h5>
                          <ul className="text-sm text-gray-300 space-y-1">
                            {investor.matchInsights.recommendations.map((rec, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <TrendingUp className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status Updates */}
                <div>
                  <h4 className="font-medium mb-3">Update Status</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Investment Status</label>
                      <Select value={localStatus} onValueChange={setLocalStatus}>
                        <SelectTrigger className="bg-dark-lighter border-dark-lighter text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-dark-lighter border-dark-lighter">
                          <SelectItem value="potential">Potential</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="interested">Interested</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                          <SelectItem value="invested">Invested</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Outreach Status</label>
                      <Select value={localOutreachStatus} onValueChange={setLocalOutreachStatus}>
                        <SelectTrigger className="bg-dark-lighter border-dark-lighter text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-dark-lighter border-dark-lighter">
                          <SelectItem value="not_contacted">Not Contacted</SelectItem>
                          <SelectItem value="email_sent">Email Sent</SelectItem>
                          <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                          <SelectItem value="follow_up">Follow Up</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <h4 className="font-medium mb-3">Notes</h4>
                  <Textarea
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    placeholder="Add notes about this investor..."
                    className="bg-dark-lighter border-dark-lighter text-white min-h-24"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setShowDetails(false)}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-dark-lighter"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateInvestor}
                    disabled={isUpdating}
                    className="bg-primary hover:bg-primary-hover text-dark font-medium"
                  >
                    {isUpdating ? 'Updating...' : 'Update Investor'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}