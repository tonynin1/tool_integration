export interface UpdateResult {
  success: boolean;
  message: string;
  oldDate?: string;
  newDate?: string;
  oldJiraKey?: string;
  newJiraKey?: string;
  oldBaselineUrl?: string;
  newBaselineUrl?: string;
  newBaselineText?: string;
  oldRepoBaselineUrl?: string;
  newRepoBaselineUrl?: string;
  oldCommitId?: string;
  newCommitId?: string;
  newCommitUrl?: string;
  pageTitle?: string;
  version?: number;
}

export interface UpdateFormValues {
  pageUrl: string;
  newDate?: any;
  newJiraKey?: string;
  newBaselineUrl?: string;
  newRepoBaselineUrl?: string;
  newCommitUrl?: string;
}

export interface UpdatePayload {
  pageUrl: string;
  newDate?: string;
  newJiraKey?: string;
  newBaselineUrl?: string;
  newRepoBaselineUrl?: string;
  newCommitUrl?: string;
}