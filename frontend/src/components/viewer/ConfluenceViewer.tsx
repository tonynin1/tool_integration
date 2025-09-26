import { Form, Row, Col } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { ConfluenceLayout, InstructionsCard } from '../shared';
import { usePageContent } from '../../hooks';
import { ViewerFormValues } from '../../types/viewer';
import { INSTRUCTION_STEPS } from '../../constants/viewer';
import { LoadPageForm } from './LoadPageForm';
import { PageInformation } from './PageInformation';
import { ContentDisplay } from './ContentDisplay';

export default function ConfluenceViewer() {
  const [form] = Form.useForm<ViewerFormValues>();
  const { loading, pageContent, fetchPage } = usePageContent();

  const handleViewPage = async (values: ViewerFormValues) => {
    await fetchPage(values.pageUrl);
  };

  const handleRefresh = () => {
    const currentUrl = form.getFieldValue('pageUrl');
    if (currentUrl) {
      fetchPage(currentUrl);
    }
  };

  return (
    <ConfluenceLayout
      title="Confluence Page Viewer"
      icon={<EyeOutlined style={{ marginRight: 8 }} />}
    >
          <Row gutter={24}>
            <Col xs={24} lg={8}>
              <LoadPageForm
                form={form}
                loading={loading}
                onSubmit={handleViewPage}
              />

              {pageContent && (
                <PageInformation pageContent={pageContent} />
              )}

              <InstructionsCard
                title="📝 Instructions"
                steps={INSTRUCTION_STEPS}
              />
            </Col>

            <Col xs={24} lg={16}>
              <ContentDisplay
                loading={loading}
                pageContent={pageContent}
                onRefresh={handleRefresh}
              />
            </Col>
          </Row>
    </ConfluenceLayout>
  );
}