// Simple test to verify testing setup
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Simple Test', () => {
  it('should render correctly', () => {
    const TestComponent = () => <div>Test Content</div>;
    
    render(<TestComponent />);
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
