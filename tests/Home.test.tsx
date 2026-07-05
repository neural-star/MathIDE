import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Home from '../src/Home'

describe('Home', () => {
  it('renders tabs and calls create/login handlers', () => {
    const onLogin = vi.fn()
    const onCreate = vi.fn()

    render(<Home onLogin={onLogin} onCreate={onCreate} />)

    expect(screen.getByText('新規登録')).toBeDefined()
    expect(screen.getByText('ログイン')).toBeDefined()

    const input = screen.getByPlaceholderText('ユーザー名')
    fireEvent.change(input, { target: { value: 'alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'アカウント作成' }))
    expect(onCreate).toHaveBeenCalledWith('alice')

    fireEvent.click(screen.getByText('ログイン'))
    const loginButtons = screen.getAllByRole('button', { name: 'ログイン' })
    expect(loginButtons).toHaveLength(2)
    fireEvent.click(loginButtons[1])
    expect(onLogin).toHaveBeenCalledWith('alice')
  })
})
