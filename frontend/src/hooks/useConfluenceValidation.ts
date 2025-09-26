import { useCallback } from 'react';

export const CONFLUENCE_URL_PATTERN = /^https:\/\/inside-docupedia\.bosch\.com\/confluence\/display\/[A-Z0-9]+\/[^\/]+$/;

export interface ExtractedPageInfo {
  spaceKey: string;
  title: string;
}

export const useConfluenceValidation = () => {
  const validateUrl = useCallback((_: any, value: string) => {
    if (!value) {
      return Promise.resolve();
    }

    if (!CONFLUENCE_URL_PATTERN.test(value)) {
      return Promise.reject(new Error('Please enter a valid Confluence page URL'));
    }

    return Promise.resolve();
  }, []);

  const extractSpaceAndTitle = useCallback((pageUrl: string): ExtractedPageInfo => {
    if (!pageUrl.includes('/confluence/display/')) {
      throw new Error('Invalid Confluence URL format');
    }

    const displayIndex = pageUrl.indexOf('/display/');
    const pathAfterDisplay = pageUrl.substring(displayIndex + '/display/'.length);
    const parts = pathAfterDisplay.split('/');

    if (parts.length < 2) {
      throw new Error('URL does not contain space and title');
    }

    const spaceKey = parts[0];
    const titlePart = parts[1];
    const title = decodeURIComponent(titlePart.replace(/\+/g, ' '));

    return { spaceKey, title };
  }, []);

  return {
    validateUrl,
    extractSpaceAndTitle,
    CONFLUENCE_URL_PATTERN
  };
};