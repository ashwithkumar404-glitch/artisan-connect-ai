import { supabase } from './supabaseClient';

/**
 * Creates a notification in the database.
 * @param {string} userId - The user ID to receive the notification
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message body
 * @param {string} [referenceId] - Optional reference UUID
 * @param {string} [referenceType] - Optional reference type (e.g. 'verification')
 */
export async function createNotification(userId, type, title, message, referenceId = null, referenceType = null) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        reference_id: referenceId,
        reference_type: referenceType,
        is_read: false
      });

    if (error) {
      console.error('Error creating notification:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error creating notification:', err);
    return false;
  }
}
