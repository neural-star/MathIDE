import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

describe('App', () => {
  it('renders the notebook shell and login page when not logged in', () => {
    render(<App />)
    expect(screen.getAllByText(/MathIDE/i).length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText('ユーザー名')).toBeDefined()
  })
})
