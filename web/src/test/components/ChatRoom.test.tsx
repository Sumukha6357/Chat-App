import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ChatRoom from '@/components/ChatRoom'

// Mock Socket.IO
const mockSocket = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

describe('ChatRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders chat interface correctly', () => {
    render(<ChatRoom roomId="test-room" username="testuser" />)
    
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    expect(screen.getByText(/connected to test-room/i)).toBeInTheDocument()
  })

  it('sends message when form is submitted', async () => {
    render(<ChatRoom roomId="test-room" username="testuser" />)
    
    const messageInput = screen.getByPlaceholderText(/type a message/i)
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    fireEvent.change(messageInput, { target: { value: 'Hello, world!' } })
    fireEvent.click(sendButton)
    
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('chat-message', {
        roomId: 'test-room',
        username: 'testuser',
        message: 'Hello, world!',
        timestamp: expect.any(Number)
      })
    })
  })

  it('displays received messages', async () => {
    render(<ChatRoom roomId="test-room" username="testuser" />)
    
    // Simulate receiving a message
    const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message')?.[1]
    if (messageHandler) {
      messageHandler({
        username: 'otheruser',
        message: 'Hi there!',
        timestamp: Date.now()
      })
    }
    
    await waitFor(() => {
      expect(screen.getByText(/otheruser: Hi there!/i)).toBeInTheDocument()
    })
  })

  it('disconnects on unmount', () => {
    const { unmount } = render(<ChatRoom roomId="test-room" username="testuser" />)
    
    unmount()
    
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })
})
