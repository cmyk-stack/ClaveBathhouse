import type { NetMessage } from "@gravity/shared";

type MessageHandler = (message: NetMessage) => void;

export class SignalClient {
  private onMessage: MessageHandler;

  constructor(onMessage: MessageHandler) {
    this.onMessage = onMessage;
  }

  connect(_url: string) {}

  setMessageHandler(handler: MessageHandler) {
    this.onMessage = handler;
  }

  send(_message: NetMessage) {}
}

export const signalClient = new SignalClient(() => undefined);
