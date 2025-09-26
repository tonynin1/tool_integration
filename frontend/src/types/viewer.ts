export interface ViewerFormValues {
  pageUrl: string;
}

export interface PageContent {
  id: string;
  title: string;
  content: string;
  space: string;
  version: number;
  lastModified: string;
  author: string;
}

export interface ApiResponse {
  id: string;
  title: string;
  body: {
    storage: {
      value: string;
    };
  };
  space: {
    name: string;
  };
  version: {
    number: number;
    when: string;
    by?: {
      displayName: string;
    };
  };
}