import { DiscussionAnalysis, Proposal, ProposalSection } from "../types";
import { elizaLogger } from '@elizaos/core';

export interface TemperatureCheckPoll {
  title: string;
  description: string;
  options: string[];
  duration: number; // in days
  threshold: number; // minimum participation threshold
}

export interface ProposalDraft {
  title: string;
  author: string;
  createdAt: Date;
  status: 'draft' | 'temperature_check' | 'proposal';
  sections: ProposalSection[];
  poll?: TemperatureCheckPoll;
  sourceDiscussions: string[]; // URLs of source discussions
  tags: string[];
  estimatedImpact: {
    technical: number; // 0-1 scale
    social: number;
    economic: number;
  };
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

export interface ProposalGeneratorOptions {
  includeTemperatureCheck?: boolean;
  pollDuration?: number; // in days
  minimumParticipationThreshold?: number;
  requireBudgetEstimate?: boolean;
}

const DEFAULT_OPTIONS: ProposalGeneratorOptions = {
  includeTemperatureCheck: true,
  pollDuration: 3,
  minimumParticipationThreshold: 0.1, // 10% of token holders
  requireBudgetEstimate: true,
};

export class ProposalGenerator {
  private generateAbstract(analysis: DiscussionAnalysis): ProposalSection {
    const { keyPoints } = analysis;
    
    const content = `
This proposal addresses key community points based on discussions.

Key Points:
${keyPoints.map(point => `- ${point}`).join('\n')}
    `.trim();

    return {
      title: 'Abstract',
      content,
      type: "summary",
    };
  }

  private generateMotivation(analysis: DiscussionAnalysis): ProposalSection {
    const { perspectives, consensus, sentiment } = analysis;
    
    const content = `
Background:
The community has expressed ${sentiment.label} sentiment regarding these topics, 
with a consensus level of ${Math.round(consensus.level * 100)}%.

Community Perspectives:
${perspectives.map(perspective => `- ${perspective}`).join('\n')}

${consensus.majorityOpinion ? `Majority Opinion: ${consensus.majorityOpinion}` : ''}
${consensus.dissenting ? `\nDissenting Views: ${consensus.dissenting}` : ''}
    `.trim();

    return {
      title: 'Motivation',
      content,
      type: "motivation",
    };
  }

  private generateSpecification(analysis: DiscussionAnalysis): ProposalSection {
    const { suggestedSolutions, proposalPotential } = analysis;
    
    const content = `
Proposed Changes:
${suggestedSolutions.map((solution, index) => `${index + 1}. ${solution}`).join('\n')}

Implementation Approach:
${this.generateImplementationSteps(analysis)}

Technical Considerations:
- Impact Level: ${proposalPotential.type === 'technical' ? 'High' : 'Medium'}
- Required Changes: ${this.generateRequiredChanges(analysis)}
${this.generateBudgetEstimate(analysis)}
    `.trim();

    return {
      title: 'Specification',
      content,
      type: "specification",
    };
  }

  private generateConclusion(analysis: DiscussionAnalysis): ProposalSection {
    const { proposalPotential, engagement } = analysis;
    
    const content = `
This proposal aims to address community needs with a confidence score of ${Math.round(proposalPotential.confidence * 100)}%.

Community Engagement:
- ${engagement.uniqueParticipants} unique participants
- ${Math.round(engagement.participationRate * 100)}% participation rate
- ${engagement.totalInteractions} total interactions

Next Steps:
1. Community feedback and discussion period (1 week)
2. Temperature check poll (3 days)
3. Final proposal refinement based on feedback
4. Formal governance proposal submission

Success Metrics:
${this.generateSuccessMetrics(analysis)}
    `.trim();

    return {
      title: 'Conclusion',
      content,
      type: "summary",
    };
  }

  private generateTemperatureCheckPoll(analysis: DiscussionAnalysis, options: ProposalGeneratorOptions): TemperatureCheckPoll {
    const { title = 'Community Discussion' } = analysis.post;
    const { topics = ['governance'] } = analysis;
    
    return {
      title: `Temperature Check: ${title}`,
      description: `This temperature check aims to gauge community sentiment on the proposed changes regarding ${topics.join(', ')}. Please vote to indicate your support level.`,
      options: [
        'Strongly Support',
        'Support with Minor Changes',
        'Need More Discussion',
        'Do Not Support',
      ],
      duration: options.pollDuration || DEFAULT_OPTIONS.pollDuration,
      threshold: options.minimumParticipationThreshold || DEFAULT_OPTIONS.minimumParticipationThreshold,
    };
  }

  private generateImplementationSteps(analysis: DiscussionAnalysis): string {
    const steps = [
      'Initial review and feedback collection',
      'Technical specification development',
      'Community review period',
      'Implementation and testing',
      'Deployment and monitoring',
    ];

    return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  }

  private generateRequiredChanges(analysis: DiscussionAnalysis): string {
    // This would be expanded based on the specific type of proposal
    const changes = [];
    
    if (analysis.proposalPotential.type === 'technical') {
      changes.push('Smart contract updates');
      changes.push('Technical documentation updates');
    } else if (analysis.proposalPotential.type === 'governance') {
      changes.push('Governance parameter updates');
      changes.push('Process documentation updates');
    }

    return changes.map(change => `- ${change}`).join('\n');
  }

  private generateBudgetEstimate(analysis: DiscussionAnalysis): string {
    if (analysis.proposalPotential.type !== 'treasury') {
      return '';
    }

    return `
Budget Estimate:
- Implementation: TBD
- Ongoing maintenance: TBD
- Contingency: 10%
    `.trim();
  }

  private generateSuccessMetrics(analysis: DiscussionAnalysis): string {
    const metrics = [
      'Increased participation in governance',
      'Improved community sentiment',
      'Technical metrics (if applicable)',
      'Economic impact metrics (if applicable)',
    ];

    return metrics.map(metric => `- ${metric}`).join('\n');
  }

  async generateProposal(
    analysis: DiscussionAnalysis,
    options: {
      includeTemperatureCheck?: boolean;
      pollDuration?: number;
      minimumParticipationThreshold?: number;
    } = {}
  ): Promise<Proposal> {
    const {
      includeTemperatureCheck = true,
      pollDuration = 7,
      minimumParticipationThreshold = 0.1,
    } = options;

    const sections: ProposalSection[] = [];

    // Generate summary section
    if (analysis.summary) {
      sections.push({
        type: "summary",
        title: "Summary",
        content: analysis.summary,
      });
    }

    // Generate motivation section
    sections.push({
      type: "motivation",
      title: "Motivation",
      content: this.generateMotivationSection(analysis),
    });

    // Generate specification section
    sections.push({
      type: "specification",
      title: "Specification",
      content: this.generateSpecificationSection(analysis),
    });

    // Generate rationale section
    sections.push({
      type: "rationale",
      title: "Rationale",
      content: this.generateRationaleSection(analysis),
    });

    // Generate risks section
    sections.push({
      type: "risks",
      title: "Risks and Considerations",
      content: this.generateRisksSection(),
    });

    const proposal: Proposal = {
      id: `PROP-${Date.now()}`,
      title: this.generateTitle(analysis),
      description: analysis.summary || "",
      sections,
      author: "DAOra Forum Analyzer",
      timestamp: new Date(),
      status: "draft",
      tags: analysis.keywords || [],
      sourceDiscussions: [analysis.postId],
      estimatedImpact: this.calculateImpact(analysis),
    };

    // Add temperature check poll if requested
    if (includeTemperatureCheck) {
      proposal.poll = {
        question: "Do you support this proposal moving forward?",
        options: [
          "Strongly Support",
          "Support with Minor Changes",
          "Need More Discussion",
          "Do Not Support",
        ],
        duration: pollDuration * 24 * 60 * 60, // Convert days to seconds
        minParticipation: minimumParticipationThreshold,
        startDate: new Date(),
        endDate: new Date(Date.now() + pollDuration * 24 * 60 * 60 * 1000),
      };
    }

    return proposal;
  }

  private generateTitle(analysis: DiscussionAnalysis): string {
    const prefix = this.getTitlePrefix(analysis);
    const base = analysis.summary?.split(".")[0] || "Community Proposal";
    return `${prefix}: ${base}`;
  }

  private getTitlePrefix(analysis: DiscussionAnalysis): string {
    const score = analysis.proposalPotential.score;
    if (score > 0.8) return "PROPOSAL";
    if (score > 0.6) return "RFC";
    return "DISCUSSION";
  }

  private generateMotivationSection(analysis: DiscussionAnalysis): string {
    let content = "## Background\n\n";
    content += analysis.summary || "This proposal addresses community needs and concerns.";
    content += "\n\n## Problem Statement\n\n";
    content += analysis.proposalPotential.reasons.map(r => `- ${r}`).join("\n");
    return content;
  }

  private generateSpecificationSection(analysis: DiscussionAnalysis): string {
    let content = "## Proposed Changes\n\n";
    if (analysis.keywords?.length) {
      content += "Key areas of focus:\n";
      content += analysis.keywords.map(k => `- ${k}`).join("\n");
    }
    return content;
  }

  private generateRationaleSection(analysis: DiscussionAnalysis): string {
    let content = "## Justification\n\n";
    content += "This proposal is supported by the following factors:\n\n";
    content += analysis.proposalPotential.reasons.map(r => `- ${r}`).join("\n");
    
    if (analysis.sentiment) {
      content += "\n\n## Community Sentiment\n\n";
      content += `The overall community sentiment is ${this.getSentimentDescription(analysis.sentiment.score)} `;
      content += `(score: ${analysis.sentiment.score.toFixed(2)}, magnitude: ${analysis.sentiment.magnitude.toFixed(2)})`;
    }
    
    return content;
  }

  private generateRisksSection(): string {
    return `## Risk Assessment

The following risks and considerations should be taken into account:

1. Implementation Complexity
2. Community Adoption
3. Resource Requirements
4. Timeline Dependencies

## Mitigation Strategies

- Thorough testing and review process
- Phased implementation approach
- Regular community feedback and adjustments
- Clear documentation and communication`;
  }

  private calculateImpact(analysis: DiscussionAnalysis): { technical: number; social: number; economic: number } {
    const score = analysis.proposalPotential.score;
    const baseImpact = score * 0.7; // Scale down the base impact

    return {
      technical: baseImpact,
      social: baseImpact,
      economic: baseImpact,
    };
  }

  private getSentimentDescription(score: number): string {
    if (score > 0.5) return "strongly positive";
    if (score > 0) return "positive";
    if (score === 0) return "neutral";
    if (score > -0.5) return "negative";
    return "strongly negative";
  }
} 