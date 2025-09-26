import React from 'react';
import { Card, Space, Typography } from 'antd';

const { Title, Text } = Typography;

export interface InstructionStep {
  title: string;
  description: string;
}

interface InstructionsCardProps {
  title: string;
  steps: InstructionStep[];
}

export const InstructionsCard: React.FC<InstructionsCardProps> = ({
  title,
  steps
}) => {
  return (
    <Card title={title} size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {steps.map((step, index) => (
          <div key={index}>
            <Title level={5}>{index + 1}. {step.title}</Title>
            <Text type="secondary">
              {step.description}
            </Text>
          </div>
        ))}
      </Space>
    </Card>
  );
};