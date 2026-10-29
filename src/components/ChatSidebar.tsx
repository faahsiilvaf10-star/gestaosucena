import { FloatingChatWidget } from './chat/FloatingChatWidget'

export function ChatSidebar({ currentUserId }: { currentUserId: string }) {
  return <FloatingChatWidget currentUserId={currentUserId} />
}

export { FloatingChatWidget }
