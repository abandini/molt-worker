/**
 * Web Push notification sender.
 * Stores subscriptions in KV, sends notifications via Web Push protocol.
 *
 * VAPID keys should be set as wrangler secrets:
 *   wrangler secret put VAPID_PUBLIC_KEY
 *   wrangler secret put VAPID_PRIVATE_KEY
 *   wrangler secret put VAPID_EMAIL
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

/**
 * Store a push subscription in KV.
 */
export async function storeSubscription(
  kv: KVNamespace | undefined,
  userId: string,
  subscription: PushSubscriptionData,
): Promise<boolean> {
  if (!kv) {
    console.warn('[Push] KV not configured, cannot store subscription');
    return false;
  }

  await kv.put(
    `push:${userId}`,
    JSON.stringify(subscription),
    { expirationTtl: 30 * 24 * 60 * 60 }, // 30 days
  );

  return true;
}

/**
 * Get a stored push subscription from KV.
 */
export async function getSubscription(
  kv: KVNamespace | undefined,
  userId: string,
): Promise<PushSubscriptionData | null> {
  if (!kv) return null;

  const raw = await kv.get(`push:${userId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PushSubscriptionData;
  } catch {
    return null;
  }
}

/**
 * Send a push notification.
 * Uses the Web Push protocol with VAPID authentication.
 *
 * Note: Full Web Push implementation requires crypto operations
 * for VAPID JWT signing and payload encryption. This is a
 * simplified version that stores the intent to notify.
 * Production implementation should use a library like web-push-cloudflare.
 */
export async function sendPushNotification(
  kv: KVNamespace | undefined,
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  const subscription = await getSubscription(kv, userId);
  if (!subscription) {
    console.warn(`[Push] No subscription for user ${userId}`);
    return false;
  }

  // Store notification in KV for retrieval by client
  // Full Web Push protocol implementation is deferred to deployment phase
  if (kv) {
    const notifications = await getQueuedNotifications(kv, userId);
    notifications.push({
      ...payload,
      timestamp: Date.now(),
    });
    await kv.put(
      `notifications:${userId}`,
      JSON.stringify(notifications),
      { expirationTtl: 7 * 24 * 60 * 60 }, // 7 days
    );
  }

  console.log(`[Push] Queued notification for ${userId}: ${payload.title}`);
  return true;
}

/**
 * Get queued notifications for a user.
 */
export async function getQueuedNotifications(
  kv: KVNamespace | undefined,
  userId: string,
): Promise<Array<PushPayload & { timestamp: number }>> {
  if (!kv) return [];

  const raw = await kv.get(`notifications:${userId}`);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
