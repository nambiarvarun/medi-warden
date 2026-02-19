/**
 * Tests for the notification title/body format.
 *
 * Verifies:
 * - Title is "Medication Reminder" (not repetitive med name)
 * - Body is "MedName - Dosage" (or just "MedName" if no dosage)
 * - Both strict and relaxed modes use the same format
 */

// ──── Types mirroring NotificationService ────

interface NotificationData {
  medicationId: string;
  scheduleId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: number;
  color: string;
}

interface NotificationContent {
  title: string;
  body: string;
}

// ──── Logic under test (mirrors NotificationService.scheduleReminder title/body) ────

function buildNotificationContent(data: NotificationData, isStrict: boolean): NotificationContent {
  // Both strict and relaxed use the same title/body format
  return {
    title: 'Medication Reminder',
    body: `${data.medicationName}${data.dosage ? ` - ${data.dosage}` : ''}`,
  };
}

// ──── Helpers ────

function makeNotificationData(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    medicationId: 'med-1',
    scheduleId: 'sched-1',
    medicationName: 'Aspirin',
    dosage: '100mg',
    scheduledTime: Date.now(),
    color: '#FF0000',
    ...overrides,
  };
}

// ──── Tests ────

describe('Notification text format', () => {
  describe('title', () => {
    it('strict mode: title is "Medication Reminder"', () => {
      const data = makeNotificationData({ medicationName: 'Aspirin' });
      const content = buildNotificationContent(data, true);
      expect(content.title).toBe('Medication Reminder');
    });

    it('relaxed mode: title is "Medication Reminder"', () => {
      const data = makeNotificationData({ medicationName: 'Aspirin' });
      const content = buildNotificationContent(data, false);
      expect(content.title).toBe('Medication Reminder');
    });

    it('title does NOT contain the medication name', () => {
      const data = makeNotificationData({ medicationName: 'Metformin' });
      const strictContent = buildNotificationContent(data, true);
      const relaxedContent = buildNotificationContent(data, false);
      expect(strictContent.title).not.toContain('Metformin');
      expect(relaxedContent.title).not.toContain('Metformin');
    });

    it('title is the same for strict and relaxed mode', () => {
      const data = makeNotificationData();
      const strictContent = buildNotificationContent(data, true);
      const relaxedContent = buildNotificationContent(data, false);
      expect(strictContent.title).toBe(relaxedContent.title);
    });
  });

  describe('body', () => {
    it('body includes medication name and dosage', () => {
      const data = makeNotificationData({ medicationName: 'Aspirin', dosage: '100mg' });
      const content = buildNotificationContent(data, false);
      expect(content.body).toBe('Aspirin - 100mg');
    });

    it('body is just medication name when no dosage', () => {
      const data = makeNotificationData({ medicationName: 'Aspirin', dosage: '' });
      const content = buildNotificationContent(data, false);
      expect(content.body).toBe('Aspirin');
    });

    it('body does not repeat medication name', () => {
      const data = makeNotificationData({ medicationName: 'Aspirin', dosage: '100mg' });
      const content = buildNotificationContent(data, false);
      // Count occurrences of medication name - should appear exactly once
      const occurrences = content.body.split('Aspirin').length - 1;
      expect(occurrences).toBe(1);
    });

    it('body format is consistent between strict and relaxed', () => {
      const data = makeNotificationData({ medicationName: 'Metformin', dosage: '500mg' });
      const strictContent = buildNotificationContent(data, true);
      const relaxedContent = buildNotificationContent(data, false);
      expect(strictContent.body).toBe(relaxedContent.body);
      expect(strictContent.body).toBe('Metformin - 500mg');
    });
  });

  describe('various medication names and dosages', () => {
    it.each([
      ['Ibuprofen', '400mg', 'Ibuprofen - 400mg'],
      ['Vitamin D3', '1000 IU', 'Vitamin D3 - 1000 IU'],
      ['Metformin HCl', '500mg twice daily', 'Metformin HCl - 500mg twice daily'],
      ['Aspirin', '', 'Aspirin'],
    ])('"%s" with dosage "%s" → body: "%s"', (name, dosage, expectedBody) => {
      const data = makeNotificationData({ medicationName: name, dosage });
      const content = buildNotificationContent(data, false);
      expect(content.title).toBe('Medication Reminder');
      expect(content.body).toBe(expectedBody);
    });
  });
});
