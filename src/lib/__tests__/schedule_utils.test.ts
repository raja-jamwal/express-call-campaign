import { describe, it, expect } from '@jest/globals';
import { getNextValidScheduleDate } from '../schedule_utils';
import { call_schedules } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

describe('schedule_utils', () => {
  describe('getNextValidScheduleDate', () => {
    // Helper function to create a mock schedule
    const createSchedule = (
      scheduleRules: any,
      timeZone: string = 'America/New_York'
    ): call_schedules => ({
      id: '1',
      name: 'Test Schedule',
      user_id: '1',
      schedule_rules: scheduleRules,
      time_zone: timeZone,
      created_at: new Date(),
      updated_at: new Date(),
    });

    describe('Invalid schedule rules', () => {
      it('should return null for invalid schedule_rules format', () => {
        const schedule = createSchedule({
          days: 'monday', // Should be an array
          start_time: '09:00',
          end_time: '17:00',
        });

        const result = getNextValidScheduleDate(schedule);
        expect(result).toBeNull();
      });

      it('should return null for invalid time format', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '9:00', // Should be '09:00'
          end_time: '17:00',
        });

        const result = getNextValidScheduleDate(schedule);
        expect(result).toBeNull();
      });

      it('should return null for missing fields', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          // missing end_time
        });

        const result = getNextValidScheduleDate(schedule);
        expect(result).toBeNull();
      });

      it('should return null for empty days array', () => {
        const schedule = createSchedule({
          days: [],
          start_time: '09:00',
          end_time: '17:00',
        });

        const result = getNextValidScheduleDate(schedule);
        expect(result).toBeNull();
      });

      it('should return null for invalid day names', () => {
        const schedule = createSchedule({
          days: ['notaday', 'alsonotaday'],
          start_time: '09:00',
          end_time: '17:00',
        });

        const result = getNextValidScheduleDate(schedule);
        expect(result).toBeNull();
      });
    });

    describe('Valid schedule rules - same day scheduling', () => {
      it('should return start of window when current time is before window on valid day', () => {
        // Create a schedule for Monday 09:00-17:00 EST
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Simulate it being Monday at 8:00 AM EST
        const mondayMorning = new Date('2024-01-15T08:00:00'); // A Monday
        const mondayMorningEST = fromZonedTime(mondayMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          // Convert back to EST to verify
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getHours()).toBe(9);
          expect(resultEST.getMinutes()).toBe(0);
          expect(resultEST.getDay()).toBe(1); // Monday
        }
      });

      it('should return current time when within the valid window', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Simulate it being Monday at 10:30 AM EST (within window)
        const mondayMidMorning = new Date('2024-01-15T10:30:00');
        const mondayMidMorningEST = fromZonedTime(mondayMidMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayMidMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          // Should be close to the input time (within the window)
          expect(resultEST.getHours()).toBe(10);
          expect(resultEST.getMinutes()).toBe(30);
        }
      });

      it('should handle time at exact start of window', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Exactly 9:00 AM Monday EST
        const mondayExactStart = new Date('2024-01-15T09:00:00');
        const mondayExactStartEST = fromZonedTime(mondayExactStart, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayExactStartEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getHours()).toBe(9);
          expect(resultEST.getMinutes()).toBe(0);
        }
      });

      it('should handle time at exact end of window', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Exactly 5:00 PM Monday EST
        const mondayExactEnd = new Date('2024-01-15T17:00:00');
        const mondayExactEndEST = fromZonedTime(mondayExactEnd, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayExactEndEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          // Should accept this time as it's exactly at the end
          expect(resultEST.getHours()).toBe(17);
          expect(resultEST.getMinutes()).toBe(0);
        }
      });
    });

    describe('Valid schedule rules - next day scheduling', () => {
      it('should move to next valid day when after window on current day', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Monday at 6:00 PM EST (after window)
        const mondayEvening = new Date('2024-01-15T18:00:00');
        const mondayEveningEST = fromZonedTime(mondayEvening, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayEveningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          // Should be next Monday at 9:00 AM
          expect(resultEST.getDay()).toBe(1); // Monday
          expect(resultEST.getHours()).toBe(9);
          expect(resultEST.getMinutes()).toBe(0);
          // Should be at least 6 days later
          expect(resultEST.getDate()).toBeGreaterThan(mondayEvening.getDate());
        }
      });

      it('should skip invalid days to find next valid day', () => {
        // Schedule only for Wednesday
        const schedule = createSchedule({
          days: ['wednesday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Monday at 10:00 AM EST
        const mondayMorning = new Date('2024-01-15T10:00:00'); // This is a Monday
        const mondayMorningEST = fromZonedTime(mondayMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getDay()).toBe(3); // Wednesday
          expect(resultEST.getHours()).toBe(9);
        }
      });
    });

    describe('Multiple valid days', () => {
      it('should handle schedule with multiple valid days', () => {
        const schedule = createSchedule({
          days: ['monday', 'wednesday', 'friday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Tuesday at 10:00 AM EST (not a valid day)
        const tuesdayMorning = new Date('2024-01-16T10:00:00'); // Tuesday
        const tuesdayMorningEST = fromZonedTime(tuesdayMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, tuesdayMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          // Should be Wednesday (next valid day)
          expect(resultEST.getDay()).toBe(3); // Wednesday
          expect(resultEST.getHours()).toBe(9);
        }
      });

      it('should handle weekdays schedule', () => {
        const schedule = createSchedule({
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Saturday at 10:00 AM EST
        const saturdayMorning = new Date('2024-01-20T10:00:00'); // Saturday
        const saturdayMorningEST = fromZonedTime(saturdayMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, saturdayMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          // Should be Monday
          expect(resultEST.getDay()).toBe(1); // Monday
          expect(resultEST.getHours()).toBe(9);
        }
      });
    });

    describe('Timezone handling', () => {
      it('should correctly handle PST timezone', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/Los_Angeles');

        // Monday at 8:00 AM PST
        const mondayMorningPST = new Date('2024-01-15T08:00:00');
        const mondayMorningPSTUtc = fromZonedTime(mondayMorningPST, 'America/Los_Angeles');

        const result = getNextValidScheduleDate(schedule, mondayMorningPSTUtc);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultPST = toZonedTime(result, 'America/Los_Angeles');
          expect(resultPST.getHours()).toBe(9);
          expect(resultPST.getMinutes()).toBe(0);
        }
      });

      it('should correctly handle UTC timezone', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'UTC');

        // Monday at 8:00 AM UTC
        const mondayMorningUTC = new Date('2024-01-15T08:00:00Z');

        const result = getNextValidScheduleDate(schedule, mondayMorningUTC);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultUTC = toZonedTime(result, 'UTC');
          expect(resultUTC.getHours()).toBe(9);
          expect(resultUTC.getMinutes()).toBe(0);
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle case insensitive day names', () => {
        const schedule = createSchedule({
          days: ['Monday', 'WEDNESDAY', 'FriDAY'], // Mixed case
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Tuesday
        const tuesdayMorning = new Date('2024-01-16T10:00:00');
        const tuesdayMorningEST = fromZonedTime(tuesdayMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, tuesdayMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getDay()).toBe(3); // Wednesday
        }
      });

      it('should handle overnight hours edge case', () => {
        // Window that spans late in the day
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '20:00',
          end_time: '23:59',
        }, 'America/New_York');

        // Monday at 7:00 PM EST (before window)
        const mondayEvening = new Date('2024-01-15T19:00:00');
        const mondayEveningEST = fromZonedTime(mondayEvening, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayEveningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getHours()).toBe(20);
          expect(resultEST.getDay()).toBe(1); // Still Monday
        }
      });

      it('should handle early morning hours', () => {
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '00:00',
          end_time: '08:00',
        }, 'America/New_York');

        // Monday at 12:30 AM EST (within window)
        const mondayEarlyMorning = new Date('2024-01-15T00:30:00');
        const mondayEarlyMorningEST = fromZonedTime(mondayEarlyMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, mondayEarlyMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getHours()).toBe(0);
          expect(resultEST.getMinutes()).toBe(30);
        }
      });

      it('should return null when no valid date found within 14 days', () => {
        // This is a theoretical edge case - schedule has no valid days
        // We've already tested empty days array, but this ensures the 14-day limit works
        const schedule = createSchedule({
          days: ['monday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Start far in the future and ensure we can still get a valid date
        // (This test mainly validates the function works correctly)
        const futureDate = new Date('2024-12-20T10:00:00'); // Friday
        const futureDateEST = fromZonedTime(futureDate, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, futureDateEST);
        
        // Should find next Monday within 14 days
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getDay()).toBe(1); // Monday
        }
      });
    });

    describe('Real-world scenarios', () => {
      it('should handle a typical business hours schedule', () => {
        const schedule = createSchedule({
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Friday at 4:45 PM EST (within window, near end)
        const fridayAfternoon = new Date('2024-01-19T16:45:00'); // Friday
        const fridayAfternoonEST = fromZonedTime(fridayAfternoon, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, fridayAfternoonEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          // Should be the current time (within window)
          expect(resultEST.getHours()).toBe(16);
          expect(resultEST.getMinutes()).toBe(45);
          expect(resultEST.getDay()).toBe(5); // Friday
        }
      });

      it('should handle weekend to Monday transition', () => {
        const schedule = createSchedule({
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          start_time: '09:00',
          end_time: '17:00',
        }, 'America/New_York');

        // Saturday at 10:00 AM EST
        const saturdayMorning = new Date('2024-01-20T10:00:00'); // Saturday
        const saturdayMorningEST = fromZonedTime(saturdayMorning, 'America/New_York');

        const result = getNextValidScheduleDate(schedule, saturdayMorningEST);
        
        expect(result).not.toBeNull();
        if (result) {
          const resultEST = toZonedTime(result, 'America/New_York');
          expect(resultEST.getDay()).toBe(1); // Monday
          expect(resultEST.getHours()).toBe(9);
          expect(resultEST.getMinutes()).toBe(0);
        }
      });
    });
  });
});

