export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  reporter: string;
  issuetype: string;
  resolution: string;
  components: string[];
  fixVersions: string[];
  affectVersions: string[];
  dueDate: string;
  created: string;
  updated: string;
  priority: string;
  link: string;
  project: string;
  description?: string;
}

export interface JiraQueryParams {
  token: string;
  server: string;
  user: string;
  timeFrom: string;
  timeTo: string;
  includeClosedTickets: boolean;
}

export interface JiraApiPayload {
  jira: {
    token: string;
    server: string;
    User: string;
    timeFrom: string;
    timeTo: string;
    closeticket: boolean;
  };
}

export interface JiraApiResponse {
  data?: JiraTicket[];
  tickets?: JiraTicket[];
  message?: string;
  error?: string;
}

export interface ExportResponse {
  downloadfile?: string;
  message?: string;
  error?: string;
}