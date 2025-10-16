// Error classes (defined inline to avoid circular imports)
export interface IPluginError extends Error {
  readonly name: string
  readonly cause?: Error
}
