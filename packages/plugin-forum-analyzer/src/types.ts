import { TemperatureCheckPoll } from './proposal/generator';

export interface ForumPost {
  id: string;
  platform: string;
  title: string;
  content: string;
  author: string;
  timestamp: Date;
  url: string;
  category?: string;
  tags?: string[];
  replies?: number;
  views?: number;
  lastActivity?: Date;
  reactions?: {
    [key: string]: number;
  };
  threadReplies?: Array<{
    author: string;
    content: string;
    timestamp: Date;
  }>;
  metadata?: {
    isSticky?: boolean;
    isLocked?: boolean;
    participantCount?: number;
    lastEditedAt?: Date;
    lastActivity?: Date;
  };
}

export interface DiscussionAnalysis {
  postId: string;
  platform: string;
  post: {
    title?: string;
    url?: string;
    author?: string;
  };
  topics: string[];
  stakeholders: string[];
  proposalPotential: ProposalPotential;
  sentiment?: {
    score: number;
    magnitude: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  keywords?: string[];
  summary?: string;
  keyPoints?: string[];
  engagement?: {
    participationRate: number;
    uniqueParticipants: number;
    totalInteractions: number;
  };
}

export interface ForumAnalyzerConfig {
  platforms: {
    discourse?: {
      url: string;
      apiKey?: string;
    };
    discord?: {
      token: string;
      channels: string[];
    };
    commonwealth?: {
      url: string;
      apiKey?: string;
    };
  };
  analysisOptions?: {
    proposalThreshold?: number;
    sentimentAnalysis?: boolean;
    keywordExtraction?: boolean;
  };
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  sections: ProposalSection[];
  author: string;
  timestamp: Date;
  status: ProposalStatus;
  tags: string[];
  sourceDiscussions: string[];
  estimatedImpact: {
    technical: number;
    social: number;
    economic: number;
  };
  poll?: ProposalPoll;
  temperatureCheck?: TemperatureCheckPoll;
  metadata?: {
    source: string;
    platform: string;
    timestamp: Date;
    author: string;
    tags: string[];
    engagement: {
      participationRate: number;
      uniqueParticipants: number;
      totalInteractions: number;
    };
  };
}

export interface ProposalSection {
  title: string;
  content: string;
  type: ProposalSectionType;
}

export type ProposalSectionType = 
  | "summary"
  | "background"
  | "motivation"
  | "specification"
  | "rationale"
  | "implementation"
  | "risks"
  | "timeline"
  | "budget"
  | "alternatives"
  | "references";

export type ProposalStatus = 
  | "draft"
  | "discussion"
  | "voting"
  | "accepted"
  | "rejected"
  | "implemented"
  | "withdrawn";

export interface ProposalPoll {
  question: string;
  options: string[];
  duration: number;
  minParticipation?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface PluginContext {
  id: string;
  name: string;
  version: string;
  config?: Record<string, unknown>;
}

export interface DiscourseConfig {
  url: string;
  apiKey?: string;
  usePublicScraping?: boolean;
  fetchOptions?: {
    maxPosts?: number;
    includeReplies?: boolean;
    fetchFullThread?: boolean;
    cacheTimeout?: number;
    scrapingDelay?: number;
  };
}

export interface AnalysisOptions {
    proposalThreshold?: number;
    sentimentAnalysis?: boolean;
    keywordExtraction?: boolean;
}

export interface ProposalPotential {
    score: number;
    confidence: number;
    type: 'governance' | 'treasury' | 'technical' | 'social' | 'other';
    reasons: string[];
    keyPoints: string[];
    consensus: {
        level: number;
        majorityOpinion?: string;
        dissenting?: string;
    };
    governanceRelevance: number;
}

export interface Sentiment {
    score: number;
    magnitude: number;
    label: 'positive' | 'negative' | 'neutral';
}

export interface ProposalWorkflowState {
    stage: ProposalStage;
    proposal: Proposal;
    temperatureCheck?: {
        poll: TemperatureCheckPoll;
        startTime: Date;
        endTime: Date;
        votes: ProposalVote[];
        governanceMetrics?: {
            criticalProposal: boolean;
            extendedDuration: boolean;
            highQuorum: boolean;
        };
    };
    discussion?: {
        startTime: Date;
        endTime: Date;
        threads: {
            id: string;
            title: string;
            url: string;
            replies: number;
            sentiment: 'positive' | 'negative' | 'neutral';
        }[];
        governanceMetrics?: {
            criticalDiscussion: boolean;
            extendedPeriod: boolean;
            requiredFrameworkChanges: boolean;
        };
    };
    voting?: {
        startTime: Date;
        endTime: Date;
        quorum: number;
        approvalThreshold: number;
        votes: ProposalVote[];
        governanceMetrics?: {
            criticalVoting: boolean;
            extendedPeriod: boolean;
            highQuorum: boolean;
            frameworkChangeRequired: boolean;
        };
    };
}

export type ProposalStage = 
    | 'draft'
    | 'temperature_check'
    | 'discussion'
    | 'final_proposal'
    | 'voting'
    | 'executed'
    | 'rejected';

export interface ProposalVote {
    voter: string;
    choice: string;
    weight: number;
    timestamp: Date;
    metadata?: {
        delegatedFrom?: string[];
        votingPower?: number;
        governanceTokens?: {
            symbol: string;
            amount: number;
        }[];
    };
} 