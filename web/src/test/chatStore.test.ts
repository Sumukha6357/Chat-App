import { useChatStore } from '../store/chatStore';

describe('chatStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useChatStore.setState({ messages: {}, rooms: [] });
  });

  it('should sort messages by createdAt ascending in addMessage', () => {
    const roomId = 'room-alpha';
    const m1 = { 
      _id: 'msg-1', 
      roomId, 
      senderId: 'user-1', 
      content: 'Later message', 
      createdAt: '2026-03-19T12:00:00Z', 
      type: 'text' 
    };
    const m2 = { 
      _id: 'msg-2', 
      roomId, 
      senderId: 'user-2', 
      content: 'Earlier message', 
      createdAt: '2026-03-19T10:00:00Z', 
      type: 'text' 
    };
    
    // Add later message first
    useChatStore.getState().addMessage(roomId, m1 as any);
    // Then add earlier message
    useChatStore.getState().addMessage(roomId, m2 as any);
    
    const messages = useChatStore.getState().messages[roomId];
    expect(messages).toHaveLength(2);
    expect(messages[0]._id).toBe('msg-2'); // msg-2 (10:00) should be first
    expect(messages[1]._id).toBe('msg-1'); // msg-1 (12:00) should be second
  });

  it('should sort messages by createdAt ascending in mergeServerMessages', () => {
    const roomId = 'room-beta';
    const m1 = { 
      _id: 'msg-1', 
      roomId, 
      senderId: 'user-1', 
      content: 'Latest', 
      createdAt: '2026-03-19T15:00:00Z', 
      type: 'text' 
    };
    const m2 = { 
      _id: 'msg-2', 
      roomId, 
      senderId: 'user-2', 
      content: 'Oldest', 
      createdAt: '2026-03-19T10:00:00Z', 
      type: 'text' 
    };
    const m3 = { 
      _id: 'msg-3', 
      roomId, 
      senderId: 'user-1', 
      content: 'Middle', 
      createdAt: '2026-03-19T12:00:00Z', 
      type: 'text' 
    };
    
    // Server returns messages in random or descending order
    useChatStore.getState().mergeServerMessages(roomId, [m1, m2, m3] as any, 'replace');
    
    const messages = useChatStore.getState().messages[roomId];
    expect(messages).toHaveLength(3);
    expect(messages[0]._id).toBe('msg-2'); // 10:00
    expect(messages[1]._id).toBe('msg-3'); // 12:00
    expect(messages[2]._id).toBe('msg-1'); // 15:00
  });

  it('should handle optimistic updates and id rotation correctly', () => {
    const roomId = 'room-gamma';
    const clientMessageId = 'client-timestamp-123';
    
    // Add optimistic message
    useChatStore.getState().addMessage(roomId, {
      _id: clientMessageId,
      roomId,
      senderId: 'me',
      content: 'Optimistic!',
      createdAt: '2026-03-19T12:00:00Z',
      clientMessageId,
      status: 'sending',
      type: 'text'
    } as any);

    let messages = useChatStore.getState().messages[roomId];
    expect(messages[0]._id).toBe(clientMessageId);

    // Update with server ID
    const serverId = 'real-mongo-id-789';
    useChatStore.getState().updateMessageId(roomId, clientMessageId, serverId, '2026-03-19T12:00:05Z');

    messages = useChatStore.getState().messages[roomId];
    expect(messages).toHaveLength(1);
    expect(messages[0]._id).toBe(serverId);
    expect(messages[0].status).toBe('sent');
  });
});
