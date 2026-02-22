import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import Pipeline from '../Pipeline';

const mockDealAPI = vi.hoisted(() => ({
  dealAPI: {
    getAll: vi.fn(),
    getPipeline: vi.fn(),
    updateStage: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => ({
  dealAPI: mockDealAPI.dealAPI,
}));

// Mock PipelineBoard component
vi.mock('../../components/PipelineBoard', () => ({
  default: () => <div data-testid="pipeline-board">Pipeline Board Component</div>,
}));

describe('Pipeline page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title', () => {
    renderWithProviders(<Pipeline />);

    expect(screen.getByText('Deal Pipeline')).toBeInTheDocument();
  });

  it('should render description text', () => {
    renderWithProviders(<Pipeline />);

    expect(screen.getByText('Drag and drop deals to move them between stages')).toBeInTheDocument();
  });

  it('should render PipelineBoard component', () => {
    renderWithProviders(<Pipeline />);

    expect(screen.getByTestId('pipeline-board')).toBeInTheDocument();
  });
});
