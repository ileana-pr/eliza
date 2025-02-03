import { elizaLogger } from '@elizaos/core';
import { ProposalDraft, TemperatureCheckPoll } from './generator';

export type ProposalStage = 'draft' | 'temperature_check' | 'discussion' | 'final_proposal' | 'voting' | 'executed' | 'rejected';

export interface ProposalWorkflowConfig {
  temperatureCheckDuration: number; // in days
  discussionPeriod: number; // in days
  votingPeriod: number; // in days
  minimumQuorum: number; // 0-1 scale
  approvalThreshold: number; // 0-1 scale
}

export interface ProposalVote {
  voter: string;
  choice: string;
  weight: number;
  timestamp: Date;
}

export interface ProposalWorkflowState {
  stage: ProposalStage;
  proposal: ProposalDraft;
  temperatureCheck?: {
    poll: TemperatureCheckPoll;
    votes: ProposalVote[];
    endTime: Date;
    result?: {
      support: number;
      opposition: number;
      needsDiscussion: number;
    };
  };
  discussion?: {
    comments: Array<{
      author: string;
      content: string;
      timestamp: Date;
    }>;
    endTime: Date;
  };
  voting?: {
    votes: ProposalVote[];
    startTime: Date;
    endTime: Date;
    result?: {
      approved: boolean;
      support: number;
      quorumReached: boolean;
    };
  };
}

const DEFAULT_CONFIG: ProposalWorkflowConfig = {
  temperatureCheckDuration: 3, // 3 days
  discussionPeriod: 7, // 7 days
  votingPeriod: 5, // 5 days
  minimumQuorum: 0.1, // 10% of total voting power
  approvalThreshold: 0.5, // 50% of votes must be in favor
};

export class ProposalWorkflow {
  private config: ProposalWorkflowConfig;
  private state: ProposalWorkflowState;

  constructor(
    proposal: ProposalDraft,
    config: Partial<ProposalWorkflowConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      stage: 'draft',
      proposal,
    };
  }

  public async startTemperatureCheck(): Promise<void> {
    if (this.state.stage !== 'draft') {
      throw new Error('Temperature check can only be started from draft stage');
    }

    if (!this.state.proposal.poll) {
      throw new Error('Proposal does not have a temperature check poll configured');
    }

    const endTime = new Date();
    endTime.setDate(endTime.getDate() + this.config.temperatureCheckDuration);

    this.state = {
      ...this.state,
      stage: 'temperature_check',
      temperatureCheck: {
        poll: this.state.proposal.poll,
        votes: [],
        endTime,
      },
    };

    elizaLogger.info('[ProposalWorkflow] Started temperature check phase');
  }

  public async submitTemperatureCheckVote(vote: ProposalVote): Promise<void> {
    if (this.state.stage !== 'temperature_check' || !this.state.temperatureCheck) {
      throw new Error('Temperature check is not active');
    }

    if (new Date() > this.state.temperatureCheck.endTime) {
      throw new Error('Temperature check period has ended');
    }

    this.state.temperatureCheck.votes.push(vote);
    elizaLogger.info('[ProposalWorkflow] Recorded temperature check vote');
  }

  public async finalizeTemperatureCheck(): Promise<void> {
    if (this.state.stage !== 'temperature_check' || !this.state.temperatureCheck) {
      throw new Error('Temperature check is not active');
    }

    const { votes } = this.state.temperatureCheck;
    const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);

    const result = {
      support: votes.filter(v => v.choice === 'Strongly Support' || v.choice === 'Support with Minor Changes')
        .reduce((sum, vote) => sum + vote.weight, 0) / totalWeight,
      opposition: votes.filter(v => v.choice === 'Do Not Support')
        .reduce((sum, vote) => sum + vote.weight, 0) / totalWeight,
      needsDiscussion: votes.filter(v => v.choice === 'Need More Discussion')
        .reduce((sum, vote) => sum + vote.weight, 0) / totalWeight,
    };

    this.state.temperatureCheck.result = result;

    // Determine next stage based on results
    if (result.support > 0.5) {
      await this.startDiscussion();
    } else if (result.needsDiscussion > 0.3) {
      this.state.stage = 'draft';
      elizaLogger.info('[ProposalWorkflow] Proposal returned to draft for more discussion');
    } else {
      this.state.stage = 'rejected';
      elizaLogger.info('[ProposalWorkflow] Proposal rejected at temperature check');
    }
  }

  public async startDiscussion(): Promise<void> {
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + this.config.discussionPeriod);

    this.state = {
      ...this.state,
      stage: 'discussion',
      discussion: {
        comments: [],
        endTime,
      },
    };

    elizaLogger.info('[ProposalWorkflow] Started discussion phase');
  }

  public async addDiscussionComment(author: string, content: string): Promise<void> {
    if (this.state.stage !== 'discussion' || !this.state.discussion) {
      throw new Error('Discussion period is not active');
    }

    if (new Date() > this.state.discussion.endTime) {
      throw new Error('Discussion period has ended');
    }

    this.state.discussion.comments.push({
      author,
      content,
      timestamp: new Date(),
    });
  }

  public async finalizeDiscussion(): Promise<void> {
    if (this.state.stage !== 'discussion') {
      throw new Error('Discussion is not active');
    }

    this.state.stage = 'final_proposal';
    elizaLogger.info('[ProposalWorkflow] Moved to final proposal stage');
  }

  public async startVoting(): Promise<void> {
    if (this.state.stage !== 'final_proposal') {
      throw new Error('Proposal must be finalized before voting');
    }

    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + this.config.votingPeriod);

    this.state = {
      ...this.state,
      stage: 'voting',
      voting: {
        votes: [],
        startTime,
        endTime,
      },
    };

    elizaLogger.info('[ProposalWorkflow] Started voting phase');
  }

  public async submitVote(vote: ProposalVote): Promise<void> {
    if (this.state.stage !== 'voting' || !this.state.voting) {
      throw new Error('Voting is not active');
    }

    if (new Date() > this.state.voting.endTime) {
      throw new Error('Voting period has ended');
    }

    this.state.voting.votes.push(vote);
    elizaLogger.info('[ProposalWorkflow] Recorded vote');
  }

  public async finalizeVoting(): Promise<void> {
    if (this.state.stage !== 'voting' || !this.state.voting) {
      throw new Error('Voting is not active');
    }

    const { votes } = this.state.voting;
    const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
    const supportWeight = votes
      .filter(v => v.choice === 'Support')
      .reduce((sum, vote) => sum + vote.weight, 0);

    const result = {
      approved: false,
      support: supportWeight / totalWeight,
      quorumReached: totalWeight >= this.config.minimumQuorum,
    };

    result.approved = result.quorumReached && result.support >= this.config.approvalThreshold;
    this.state.voting.result = result;
    this.state.stage = result.approved ? 'executed' : 'rejected';

    elizaLogger.info(`[ProposalWorkflow] Proposal ${result.approved ? 'approved' : 'rejected'}`);
  }

  public getState(): ProposalWorkflowState {
    return this.state;
  }

  public getCurrentStage(): ProposalStage {
    return this.state.stage;
  }
} 