// @vitest-environment jsdom
// UI test: renders the real Navigator in a fake DOM (jsdom) and drives it like a
// user would, with chrome mocked. The docblock above switches just this file
// from the default Node environment to jsdom.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installChromeMock } from '../test/chromeMock'
import { DEFAULT_KEYBINDINGS } from '../types'
import Navigator from './Navigator'

beforeEach(() => {
  installChromeMock()
})
afterEach(cleanup)

const renderNavigator = () =>
  render(
    <Navigator
      keybindings={DEFAULT_KEYBINDINGS}
      stashAllOpensFullView
      onOpenPreferences={() => {}}
    />,
  )

describe('Navigator search', () => {
  it('shows a new bin in rename mode (no search)', async () => {
    renderNavigator()
    fireEvent.click(screen.getByRole('button', { name: /New Bin/ }))
    expect(await screen.findByDisplayValue('New Bin')).toBeTruthy()
  })

  it('keeps a new bin visible while searching, so you can name it', async () => {
    renderNavigator()

    // A query the new bin's default name ("New Bin") doesn't match.
    fireEvent.change(screen.getByPlaceholderText('Search tabs and bins…'), {
      target: { value: 'zzz' },
    })
    fireEvent.click(screen.getByRole('button', { name: /New Bin/ }))

    // The new bin opens in rename mode: its name box should be on screen.
    expect(await screen.findByDisplayValue('New Bin')).toBeTruthy()
  })
})
