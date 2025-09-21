import React, { useState } from 'react';
import { format } from 'date-fns';
import { JiraQueryParams } from '../types/jira';

interface JiraQueryFormProps {
  onSubmit: (params: JiraQueryParams) => void;
  isLoading: boolean;
}

interface FormErrors {
  [key: string]: string;
}

const JiraQueryForm: React.FC<JiraQueryFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<JiraQueryParams>({
    // token: 'MTc1ODc5NzI1NDAzOvElV8SPRsQAEL9fYFodnlEWM05j',
    // token: 'MjkyMDI1NTU2NzcxOlbw8l9C8iHkykCuCsGFzxORK9ai',
    token: 'NTQ2ODIyMjc2NDcwOrCCYzHQsyfVH9kLOWTqa/ZtnidU',
    server: 'https://rb-tracker.bosch.com/tracker08',
    // server: 'https://rb-tracker.bosch.com/tracker19',
    user: '',
    timeFrom: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // 30 days ago
    timeTo: format(new Date(), 'yyyy-MM-dd'), // today
    includeClosedTickets: false
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.token.trim()) {
      newErrors.token = 'OAuth2 token is required';
    }

    if (!formData.server.trim()) {
      newErrors.server = 'Jira server URL is required';
    } else if (!formData.server.startsWith('http')) {
      newErrors.server = 'Server URL must start with http:// or https://';
    }

    if (!formData.user.trim()) {
      newErrors.user = 'Username or account ID is required';
    }

    if (!formData.timeFrom) {
      newErrors.timeFrom = 'Start date is required';
    }

    if (!formData.timeTo) {
      newErrors.timeTo = 'End date is required';
    }

    if (formData.timeFrom && formData.timeTo && formData.timeFrom > formData.timeTo) {
      newErrors.timeTo = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Query Jira Tickets</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OAuth2 Token */}
          <div className="md:col-span-2">
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
              OAuth2 Access Token *
            </label>
            <input
              type="password"
              id="token"
              name="token"
              value={formData.token}
              onChange={handleChange}
              className={`form-control ${errors.token ? 'error' : ''}`}
              placeholder="Your Jira OAuth2 token"
            />
            {errors.token && <p className="mt-1 text-sm text-red-600">{errors.token}</p>}
          </div>

          {/* Server URL */}
          <div className="md:col-span-2">
            <label htmlFor="server" className="block text-sm font-medium text-gray-700 mb-1">
              Jira Server URL *
            </label>
            <input
              type="url"
              id="server"
              name="server"
              value={formData.server}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.server ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://your-domain.atlassian.net"
            />
            {errors.server && <p className="mt-1 text-sm text-red-600">{errors.server}</p>}
          </div>

          {/* Username */}
          <div className="md:col-span-2">
            <label htmlFor="user" className="block text-sm font-medium text-gray-700 mb-1">
              Username or Account ID *
            </label>
            <input
              type="text"
              id="user"
              name="user"
              value={formData.user}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.user ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="username or account-id"
            />
            {errors.user && <p className="mt-1 text-sm text-red-600">{errors.user}</p>}
          </div>

          {/* Date Range */}
          <div>
            <label htmlFor="timeFrom" className="block text-sm font-medium text-gray-700 mb-1">
              From Date *
            </label>
            <input
              type="date"
              id="timeFrom"
              name="timeFrom"
              value={formData.timeFrom}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.timeFrom ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.timeFrom && <p className="mt-1 text-sm text-red-600">{errors.timeFrom}</p>}
          </div>

          <div>
            <label htmlFor="timeTo" className="block text-sm font-medium text-gray-700 mb-1">
              To Date *
            </label>
            <input
              type="date"
              id="timeTo"
              name="timeTo"
              value={formData.timeTo}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.timeTo ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.timeTo && <p className="mt-1 text-sm text-red-600">{errors.timeTo}</p>}
          </div>
        </div>

        {/* Include Closed Tickets */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="includeClosedTickets"
            name="includeClosedTickets"
            checked={formData.includeClosedTickets}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="includeClosedTickets" className="ml-2 block text-sm text-gray-700">
            Include closed/resolved tickets
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Querying Tickets...
              </>
            ) : (
              'Query Tickets'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JiraQueryForm;