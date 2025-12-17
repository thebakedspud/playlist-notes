import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LandingScreen from '../LandingScreen.jsx'

// Stub requestAnimationFrame (matches existing test patterns)
beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb) => cb())
})

afterEach(() => {
    vi.unstubAllGlobals()
})

const createDefaultProps = () => ({
    importUrl: '',
    onImportUrlChange: vi.fn(),
    importError: null,
    providerChip: null,
    isAnyImportBusy: false,
    showInitialSpinner: false,
    importInputRef: { current: null },
    onImport: vi.fn(),
    recentPlaylists: [],
    recentCardState: {},
    onSelectRecent: vi.fn(),
    refreshingRecentId: null,
    isRefreshingCachedData: false,
})

describe('LandingScreen', () => {
    it('renders import form with URL input', () => {
        render(<LandingScreen {...createDefaultProps()} />)
        expect(screen.getByRole('textbox', { name: /playlist url/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /import playlist/i })).toBeInTheDocument()
    })

    it('shows error message with correct aria bindings on input and form', () => {
        const props = {
            ...createDefaultProps(),
            importError: { message: 'Invalid URL', type: 'error' },
        }
        render(<LandingScreen {...props} />)

        // Input should have aria-invalid and aria-describedby
        const input = screen.getByRole('textbox')
        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(input).toHaveAttribute('aria-describedby', 'import-error')

        // Form should also have aria-describedby (both elements reference the error)
        const form = input.closest('form')
        expect(form).toHaveAttribute('aria-describedby', 'import-error')

        expect(screen.getByText('Invalid URL')).toBeInTheDocument()
    })

    it('disables button when import is busy', () => {
        const props = {
            ...createDefaultProps(),
            isAnyImportBusy: true,
        }
        render(<LandingScreen {...props} />)
        expect(screen.getByRole('button', { name: /import playlist/i })).toBeDisabled()
    })

    it('does not render recent playlists section when list is empty', () => {
        render(<LandingScreen {...createDefaultProps()} />)
        expect(screen.queryByText('Previously imported')).not.toBeInTheDocument()
    })

    it('renders demo helper only when helper is enabled and handler is provided', () => {
        const helperHeading = /no playlist link\? try our demo/i

        // Default props: helper should be hidden
        render(<LandingScreen {...createDefaultProps()} />)
        expect(screen.queryByRole('heading', { name: helperHeading })).toBeNull()

        // showDemoHelper without onLoadDemo: still hidden
        render(<LandingScreen {...{ ...createDefaultProps(), showDemoHelper: true }} />)
        expect(screen.queryByRole('heading', { name: helperHeading })).toBeNull()

        // Both showDemoHelper and onLoadDemo: helper is visible
        const onLoadDemo = vi.fn()
        render(<LandingScreen {...{ ...createDefaultProps(), showDemoHelper: true, onLoadDemo }} />)
        expect(screen.getByRole('heading', { name: helperHeading })).toBeInTheDocument()
    })

    it('calls onLoadDemo when helper is clicked without submitting the form', () => {
        const helperLabel = /load demo playlist with timestamped notes/i
        const onLoadDemo = vi.fn()
        const onImport = vi.fn()

        render(<LandingScreen {...{ ...createDefaultProps(), showDemoHelper: true, onLoadDemo, onImport }} />)

        const helperButton = screen.getByRole('button', { name: helperLabel })
        fireEvent.click(helperButton)

        expect(onLoadDemo).toHaveBeenCalledTimes(1)
        expect(onImport).not.toHaveBeenCalled()
    })
})
