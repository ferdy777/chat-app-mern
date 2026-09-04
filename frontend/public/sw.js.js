// Minimal service worker: only handles push events and notification clicks.
// No caching/offline logic here — keep it out unless you actually want a PWA.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();

  const options = {
    body: payload.body,
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(payload.title || "New message", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => "focus" in c);
      if (existing) {
        existing.focus();
        existing.postMessage({ type: "OPEN_CONVERSATION", conversationId });
      } else {
        self.clients.openWindow("/");
      }
    })
  );
});