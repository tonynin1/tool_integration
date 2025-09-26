import React from 'react';
import { Form, Input, Space, Tooltip } from 'antd';
import { LinkOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useConfluenceValidation } from '../../hooks/useConfluenceValidation';

interface UrlInputProps {
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  tooltip?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UrlInput: React.FC<UrlInputProps> = ({
  name,
  label,
  placeholder,
  required = false,
  tooltip,
  onChange
}) => {
  const { validateUrl } = useConfluenceValidation();

  return (
    <Form.Item
      label={
        <Space>
          <LinkOutlined />
          <span>{label}</span>
          {tooltip && (
            <Tooltip title={tooltip}>
              <InfoCircleOutlined style={{ color: '#666' }} />
            </Tooltip>
          )}
        </Space>
      }
      name={name}
      rules={[
        ...(required ? [{ required: true, message: `Please enter the ${label.toLowerCase()}` }] : []),
        { validator: validateUrl }
      ]}
    >
      <Input
        placeholder={placeholder}
        onChange={onChange}
      />
    </Form.Item>
  );
};