/* eslint-disable @typescript-eslint/ban-ts-comment */
import vscode from 'vscode';
import { nanoid } from 'nanoid';

export type EventType = 'requests' | 'commands';

export interface EventMessage {
  eventType?: EventType;
  eventId: string;
  method: string;
  params?;
}

interface CallParams {
  eventType?: EventType;
  method: string;
  params?;
}

type BindListener =
  | ((message) => Record<string, unknown>)
  | null
  | ((message) => Promise<Record<string, unknown> | null>);

export default class Channel {
  vscode: any;
  webview: vscode.Webview;
  context: vscode.ExtensionContext;
  constructor(context?: vscode.ExtensionContext, webviewPanel?: vscode.WebviewPanel) {
    // @ts-ignore
    this.vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
    if (!this.vscode) {
      this.webview = webviewPanel.webview;
      this.context = context;
    }
  }

  call({ eventType, method, params }: CallParams) {
    return new Promise(resolve => {
      const eventId = nanoid();

      if (this.vscode) {
        this.vscode.postMessage({ eventType, eventId, method, params });
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.eventId === eventId) {
            resolve(message);
          }
        });
      } else {
        this.webview.postMessage({ eventType, eventId, method, params });
        this.webview.onDidReceiveMessage(
          message => {
            if (message.eventId === eventId) {
              resolve(message);
            }
          },
          undefined,
          this.context.subscriptions
        );
      }
    });
  }

  bind(listener: BindListener) {
    if (this.vscode) {
      window.addEventListener('message', async event => {
        const message: EventMessage = event.data;
        const data = await listener(message);
        this.vscode.postMessage({ ...message, payload: data });
      });
    } else {
      this.webview.onDidReceiveMessage(
        async (message: EventMessage) => {
          const data = await listener(message);
          this.webview.postMessage({ ...message, payload: data });
        },
        undefined,
        this.context.subscriptions
      );
    }
  }
}
