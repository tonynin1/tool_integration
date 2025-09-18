import React from 'react';
import { format } from 'date-fns';
import { JiraTicket } from '../types/jira';

interface TicketCardProps {
  ticket: JiraTicket;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  const getStatusBadgeClass = (status: string): string => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('done') || statusLower.includes('resolved')) {
      return 'status-badge status-done';
    }
    if (statusLower.includes('progress') || statusLower.includes('development')) {
      return 'status-badge status-in-progress';
    }
    if (statusLower.includes('closed')) {
      return 'status-badge status-closed';
    }
    return 'status-badge status-open';
  };

  const getPriorityClass = (priority: string): string => {
    const priorityLower = priority?.toLowerCase() || '';
    if (priorityLower.includes('highest') || priorityLower.includes('blocker')) {
      return 'priority-highest';
    }
    if (priorityLower.includes('high') || priorityLower.includes('critical')) {
      return 'priority-high';
    }
    if (priorityLower.includes('medium') || priorityLower.includes('major')) {
      return 'priority-medium';
    }
    if (priorityLower.includes('low') || priorityLower.includes('minor')) {
      return 'priority-low';
    }
    if (priorityLower.includes('lowest') || priorityLower.includes('trivial')) {
      return 'priority-lowest';
    }
    return 'priority-medium';
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const openInJira = (): void => {
    if (ticket.link) {
      window.open(ticket.link, '_blank');
    }
  };

  return (
    <div className="ticket-card">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            <button
              onClick={openInJira}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {ticket.key}
            </button>
          </h3>
          <p className="text-gray-700 text-sm line-clamp-2">
            {ticket.summary || 'No summary available'}
          </p>
        </div>
        <div className="ml-4 flex flex-col items-end space-y-2">
          <span className={getStatusBadgeClass(ticket.status)}>
            {ticket.status || 'Unknown'}
          </span>
          {ticket.priority && (
            <span className={`text-sm font-medium ${getPriorityClass(ticket.priority)}`}>
              {ticket.priority}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
        <div>
          <span className="font-medium">Type:</span>
          <span className="ml-1">{ticket.issuetype || 'N/A'}</span>
        </div>
        <div>
          <span className="font-medium">Resolution:</span>
          <span className="ml-1">{ticket.resolution || 'Unresolved'}</span>
        </div>
        <div>
          <span className="font-medium">Assignee:</span>
          <span className="ml-1">{ticket.assignee || 'Unassigned'}</span>
        </div>
        <div>
          <span className="font-medium">Reporter:</span>
          <span className="ml-1">{ticket.reporter || 'N/A'}</span>
        </div>
      </div>

      {ticket.components && ticket.components.length > 0 && (
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-600">Components:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {ticket.components.map((component, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800"
              >
                {component}
              </span>
            ))}
          </div>
        </div>
      )}

      {ticket.fixVersions && ticket.fixVersions.length > 0 && (
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-600">Fix Versions:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {ticket.fixVersions.map((version, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
              >
                {version}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-gray-200 text-xs text-gray-500">
        <div>
          <span className="font-medium">Created:</span>
          <span className="ml-1">{formatDate(ticket.created)}</span>
        </div>
        <div>
          <span className="font-medium">Updated:</span>
          <span className="ml-1">{formatDate(ticket.updated)}</span>
        </div>
      </div>

      {ticket.dueDate && (
        <div className="mt-2 text-xs">
          <span className="font-medium text-orange-600">Due:</span>
          <span className="ml-1 text-orange-600">{formatDate(ticket.dueDate)}</span>
        </div>
      )}
    </div>
  );
};

export default TicketCard;