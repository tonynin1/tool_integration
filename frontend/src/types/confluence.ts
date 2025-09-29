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
  oldTagName?: string;
  newTagName?: string;
  newTagUrl?: string;
  oldBranchName?: string;
  newBranchName?: string;
  newBranchUrl?: string;
  toolLinksUpdated?: boolean;
  toolLinksValue?: string;
  intTestLinksUpdated?: boolean;
  intTestLinksValue?: string;
  binaryPathUpdated?: boolean;
  binaryPathValue?: string;
  oldBinaryPath?: string;
  newBinaryPath?: string;
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
  newTagUrl?: string;
  newBranchUrl?: string;
  toolLinks?: string;
  intTestLinks?: string;
  binaryPath?: string;
}

export interface UpdatePayload {
  pageUrl: string;
  newDate?: string;
  newJiraKey?: string;
  newBaselineUrl?: string;
  newRepoBaselineUrl?: string;
  newCommitUrl?: string;
  newTagUrl?: string;
  newBranchUrl?: string;
  toolLinks?: string;
  intTestLinks?: string;
  binaryPath?: string;
}