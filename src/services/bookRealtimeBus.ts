export type NewBookNotificationPayload = {
  type?: string;
  bookId?: number;
  title?: string;
  authorName?: string;
  message?: string;
};

export const NEW_BOOK_EVENT_NAME = "books:new-book";

export const emitNewBookEvent = (payload: NewBookNotificationPayload) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NewBookNotificationPayload>(NEW_BOOK_EVENT_NAME, {
      detail: payload,
    }),
  );
};

export const subscribeNewBookEvent = (
  handler: (payload: NewBookNotificationPayload) => void,
) => {
  if (typeof window === "undefined") return () => {};

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<NewBookNotificationPayload>;
    handler(customEvent.detail ?? {});
  };

  window.addEventListener(NEW_BOOK_EVENT_NAME, listener as EventListener);
  return () => {
    window.removeEventListener(NEW_BOOK_EVENT_NAME, listener as EventListener);
  };
};
