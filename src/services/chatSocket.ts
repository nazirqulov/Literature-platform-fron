import api from "./api";

export type ChatFrameHandler = (
  payload: Record<string, unknown>,
  meta: { destination?: string; rawBody: string },
) => void;

type ConnectOptions = {
  token: string;
  onConnect?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
};

type PendingSubscription = {
  destination: string;
  handler: ChatFrameHandler;
};

type StompSubscriptionLike = {
  unsubscribe: () => void;
};

type StompClientLike = {
  active: boolean;
  onConnect?: (frame: unknown) => void;
  onStompError?: (frame: { headers?: Record<string, string>; body?: string }) => void;
  onWebSocketError?: () => void;
  onWebSocketClose?: (event: { code: number; reason?: string }) => void;
  activate: () => void;
  deactivate: () => void;
  subscribe: (
    destination: string,
    callback: (message: { body: string; headers: Record<string, string> }) => void,
  ) => StompSubscriptionLike;
  publish: (payload: {
    destination: string;
    body: string;
    headers?: Record<string, string>;
  }) => void;
};

const resolveWsHttpEndpoint = (token: string) => {
  const rawBase = api.defaults.baseURL ?? window.location.origin;
  const base = rawBase.startsWith("http") ? rawBase : window.location.origin;
  const url = new URL(base);
  url.pathname = "/ws";
  url.search = "";
  if (token) {
    url.searchParams.set("access_token", token);
  }
  return url.toString();
};

const parseMessagePayload = (rawBody: string) => {
  if (!rawBody) return {} as Record<string, unknown>;
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { content: rawBody };
  }
};

export class ChatSocketClient {
  private client: StompClientLike | null = null;
  private connected = false;
  private connectTimeoutId: number | null = null;
  private subscriptionCounter = 0;
  private subscriptions = new Map<string, StompSubscriptionLike>();
  private pendingSubscriptions = new Map<string, PendingSubscription>();
  private connectOptions: ConnectOptions | null = null;

  isConnected = () => this.connected;

  connect = async (options: ConnectOptions): Promise<void> => {
    this.connectOptions = options;
    if (!options.token) throw new Error("Access token topilmadi.");
    if (this.client?.active || this.connected) return;

    const endpoint = resolveWsHttpEndpoint(options.token);

    let ClientCtor: new (config: Record<string, unknown>) => StompClientLike;
    let SockJSCtor: new (url: string) => WebSocket;

    try {
      const [stompModule, sockjsModule] = await Promise.all([
        import("@stomp/stompjs"),
        import("sockjs-client/dist/sockjs.min.js"),
      ]);

      ClientCtor = stompModule.Client as unknown as new (
        config: Record<string, unknown>,
      ) => StompClientLike;
      SockJSCtor = ((sockjsModule as { default?: unknown }).default ??
        (sockjsModule as unknown)) as new (url: string) => WebSocket;
    } catch {
      throw new Error("WebSocket kutubxonalari yuklanmadi.");
    }

    this.client = new ClientCtor({
      webSocketFactory: () => new SockJSCtor(endpoint),
      reconnectDelay: 5000,
      connectHeaders: {
        Authorization: `Bearer ${options.token}`,
      },
      debug: (line: string) => {
        if (import.meta.env.DEV) {
          console.debug("[STOMP]", line);
        }
      },
    });

    this.client.onConnect = () => {
      this.connected = true;
      if (this.connectTimeoutId != null) {
        window.clearTimeout(this.connectTimeoutId);
        this.connectTimeoutId = null;
      }
      this.pendingSubscriptions.forEach((item, id) => {
        this.subscribeInternal(id, item.destination, item.handler);
      });
      this.pendingSubscriptions.clear();
      options.onConnect?.();
    };

    this.client.onStompError = (frame) => {
      const message =
        frame.headers?.message || frame.body || "STOMP xatolik qaytdi.";
      options.onError?.(message);
    };

    this.client.onWebSocketError = () => {
      options.onError?.("WebSocket xatoligi yuz berdi.");
    };

    this.client.onWebSocketClose = (event) => {
      const wasConnected = this.connected;
      this.connected = false;
      if (this.connectTimeoutId != null) {
        window.clearTimeout(this.connectTimeoutId);
        this.connectTimeoutId = null;
      }

      if (!wasConnected) {
        options.onError?.(
          `Ulanish yopildi (code: ${event.code}${event.reason ? `, reason: ${event.reason}` : ""})`,
        );
      } else {
        options.onClose?.();
      }
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.client) {
        reject(new Error("STOMP client yaratilmagan."));
        return;
      }

      this.connectTimeoutId = window.setTimeout(() => {
        reject(new Error("WebSocket ulanish vaqti tugadi."));
      }, 12000);

      const originalOnConnect = this.client.onConnect;
      this.client.onConnect = (frame) => {
        originalOnConnect?.(frame);
        resolve();
      };

      const originalOnWebSocketError = this.client.onWebSocketError;
      this.client.onWebSocketError = () => {
        originalOnWebSocketError?.();
        reject(new Error("WebSocket ulanishida xatolik."));
      };

      this.client.activate();
    });
  };

  disconnect = () => {
    this.connected = false;
    if (this.connectTimeoutId != null) {
      window.clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
    this.client?.deactivate();
    this.client = null;
  };

  subscribe = (destination: string, handler: ChatFrameHandler) => {
    const id = `sub-${this.subscriptionCounter++}`;

    if (this.connected) {
      this.subscribeInternal(id, destination, handler);
    } else {
      this.pendingSubscriptions.set(id, { destination, handler });
    }

    return () => {
      this.pendingSubscriptions.delete(id);
      const existing = this.subscriptions.get(id);
      if (existing) {
        existing.unsubscribe();
        this.subscriptions.delete(id);
      }
    };
  };

  send = (destination: string, payload: Record<string, unknown>) => {
    if (!this.client || !this.connected) {
      this.connectOptions?.onError?.("Chat server bilan ulanish yo'q.");
      return;
    }

    this.client.publish({
      destination,
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
      },
    });
  };

  private subscribeInternal = (
    id: string,
    destination: string,
    handler: ChatFrameHandler,
  ) => {
    if (!this.client) return;
    const sub = this.client.subscribe(destination, (message) => {
      const payload = parseMessagePayload(message.body);
      handler(payload, {
        destination: message.headers.destination,
        rawBody: message.body,
      });
    });
    this.subscriptions.set(id, sub);
  };
}

