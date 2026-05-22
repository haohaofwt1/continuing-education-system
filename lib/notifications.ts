export function createNotification(type: string, title: string, message: string) {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    readAt: null,
    createdAt: new Date().toISOString()
  };
}
