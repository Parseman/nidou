self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Nidou 🐱', {
      body: data.body,
      icon: '/nidou-logo.png',
      badge: '/nidou-logo.png',
      tag: data.tag ?? 'nidou',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
