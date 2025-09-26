import React from 'react';
import { Card, Typography } from 'antd';

const { Text, Paragraph } = Typography;

const ConfluenceInstructions: React.FC = () => {
  return (
    <Card size="small" type="inner" title="How to use this tool">
      <Paragraph>
        <Text strong>Step 1:</Text> Navigate to your Confluence page in your browser
      </Paragraph>
      <Paragraph>
        <Text strong>Step 2:</Text> Copy the URL from the address bar (should look like:
        <code> https://inside-docupedia.bosch.com/confluence/display/SPACE/Page+Title</code>)
      </Paragraph>
      <Paragraph>
        <Text strong>Step 3:</Text> Paste the URL in the first field above
      </Paragraph>
      <Paragraph>
        <Text strong>Step 4:</Text> Fill in any combination of the optional fields:
        <br />• Release date: Updates <code>&lt;time datetime=""&gt;</code> tags
        <br />• Jira ticket key: Updates Jira references in the page
        <br />• Predecessor baseline URL: Updates predecessor baseline links with auto-extracted text
        <br />• Repository baseline URL: Updates repository URLs in SW Baseline section
      </Paragraph>
      <Paragraph>
        <Text strong>Step 5:</Text> Click "Update Page Content" - at least one optional field must be provided
      </Paragraph>
    </Card>
  );
};

export default ConfluenceInstructions;