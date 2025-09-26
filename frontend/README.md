# Jira Tickets Query React App

A React TypeScript application for querying and managing Jira tickets for specific users.

## Features

- **Query Jira Tickets**: Search for tickets assigned to specific users within date ranges
- **Filter & Sort**: Filter by status, issue type, and search terms. Sort by various fields
- **Export Functionality**: Export tickets to Excel/CSV format
- **Responsive Design**: Modern UI with Tailwind CSS
- **TypeScript Support**: Full type safety and IntelliSense

## Prerequisites

- Node.js (v16 or higher)
- Access to the Jira integration backend API
- Valid Jira OAuth2 token

## Installation

1. Navigate to the project directory:
```bash
cd /tool_int
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The app will open in your browser at `http://localhost:3000`.

## Usage

### 1. Configure Connection
- **OAuth2 Token**: Enter your Jira OAuth2 access token
- **Server URL**: Enter your Jira instance URL (e.g., `https://your-domain.atlassian.net`)
- **Username**: Enter the username or account ID to query tickets for

### 2. Set Date Range
- **From Date**: Start date for ticket creation filter
- **To Date**: End date for ticket creation filter
- **Include Closed**: Check to include closed/resolved tickets

### 3. Query Tickets
Click "Query Tickets" to fetch tickets matching your criteria.

### 4. Manage Results
- **Search**: Use the search box to filter tickets by key, summary, assignee, or reporter
- **Filter**: Use dropdown filters for status and issue type
- **Sort**: Click sort buttons to order by different fields
- **Export**: Click "Export" to download tickets as Excel file

## API Integration

The app integrates with the existing Jira backend API:

### Endpoints Used:
- `POST /jira_updater/query` - Query tickets for a user
- `POST /jira_updater/export` - Export tickets to file
- `GET /jira_updater/getquery` - Test API connection

### Request Format:
```json
{
  "jira": {
    "token": "oauth2-token",
    "server": "https://domain.atlassian.net",
    "User": "username",
    "timeFrom": "2024-01-01",
    "timeTo": "2024-01-31",
    "closeticket": false
  }
}
```

## Project Structure

```
src/
├── components/
│   ├── JiraQueryForm.tsx    # Query form component
│   ├── TicketCard.tsx       # Individual ticket display
│   └── TicketsList.tsx      # Tickets list with filters
├── services/
│   └── jiraApi.ts          # API service layer
├── types/
│   └── jira.ts             # TypeScript type definitions
├── App.tsx                 # Main application component
├── index.tsx               # Application entry point
└── index.css               # Styles and Tailwind CSS
```

## TypeScript Types

### JiraTicket
```typescript
interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  reporter: string;
  issuetype: string;
  resolution: string;
  components: string[];
  fixVersions: string[];
  // ... more fields
}
```

### JiraQueryParams
```typescript
interface JiraQueryParams {
  token: string;
  server: string;
  user: string;
  timeFrom: string;
  timeTo: string;
  includeClosedTickets: boolean;
}
```

## Styling

The app uses Tailwind CSS for styling with custom CSS classes for:
- Ticket cards with hover effects
- Status badges with color coding
- Priority indicators
- Responsive grid layouts

## Error Handling

- Form validation with real-time feedback
- API error handling with user-friendly messages
- Loading states for better UX
- Network error detection

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

## Configuration

The app expects the backend API to be available at the same origin (configured via `proxy` in package.json). For production, update the API base URL in `src/services/jiraApi.ts`.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Follow TypeScript best practices
2. Use proper type annotations
3. Add error handling for new features
4. Update types when adding new API fields
5. Test responsive design on different screen sizes