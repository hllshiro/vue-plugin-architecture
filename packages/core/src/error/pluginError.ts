import type { IPluginError } from '@vue-plugin-arch/types'
export class PluginError extends Error implements IPluginError {
  public readonly name: string
  public readonly cause?: Error

  constructor(name: string, message: string, cause?: Error) {
    super(`[${name}] ${message}`)
    this.name = 'PluginError'
    this.name = name
    this.cause = cause
    Object.setPrototypeOf(this, PluginError.prototype)
  }
}
