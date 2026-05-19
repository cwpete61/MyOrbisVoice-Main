declare module 'sns-validator' {
  type SnsMessage = Record<string, unknown>
  class MessageValidator {
    constructor(hostPattern?: RegExp, encoding?: string)
    validate(
      message: SnsMessage,
      callback: (err: Error | null, message: SnsMessage) => void,
    ): void
  }
  export = MessageValidator
}
