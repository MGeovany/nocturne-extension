export function isExtensionContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Extension context invalidated')
}

export function ignoreExtensionContextInvalidated(error: unknown): void {
  if (!isExtensionContextInvalidated(error)) throw error
}
