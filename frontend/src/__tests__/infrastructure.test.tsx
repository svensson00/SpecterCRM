import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from './helpers/test-utils';

describe('Test Infrastructure', () => {
  it('should run basic tests', () => {
    expect(true).toBe(true);
  });

  it('should render a simple component', () => {
    const TestComponent = () => <div>Hello Test</div>;
    renderWithProviders(<TestComponent />);
    expect(screen.getByText('Hello Test')).toBeInTheDocument();
  });

  it('should have localStorage mocked', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.clear();
    expect(localStorage.getItem('test')).toBeNull();
  });
});
