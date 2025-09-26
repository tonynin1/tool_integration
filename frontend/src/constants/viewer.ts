import { InstructionStep } from '../components/shared';

export const API_ENDPOINTS = {
  GET_PAGE: 'http://localhost:3002/api/get-page'
} as const;

export const NOTIFICATION_DURATION = {
  SUCCESS: 3,
  ERROR: 10
} as const;

export const INSTRUCTION_STEPS: InstructionStep[] = [
  {
    title: 'Enter URL',
    description: 'Paste the full URL of any Confluence page you want to view'
  },
  {
    title: 'Load Content',
    description: 'Click "Load Page" to fetch and display the page content'
  },
  {
    title: 'View Content',
    description: 'The page content will be displayed on the right with formatting preserved'
  }
];

export const PLACEHOLDER_URL = 'https://inside-docupedia.bosch.com/confluence/display/EBR/GWM+FVE0120+BL02+V5';