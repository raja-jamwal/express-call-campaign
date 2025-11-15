import { call_schedules } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import {
  addDays,
  set,
  isBefore,
  isAfter,
  startOfDay,
  getDay,
} from 'date-fns';

/**
 * Defines the expected structure of the schedule_rules JSON object.
 */
interface ScheduleRules {
  days: string[];
  start_time: string; // e.g., "09:00"
  end_time: string;   // e.g., "17:00"
}

/**
 * A type guard to validate the structure of the schedule_rules object.
 * @param rules - The object to validate.
 * @returns True if the object matches the ScheduleRules interface.
 */
function isValidScheduleRules(rules: any): rules is ScheduleRules {
  return (
    rules &&
    Array.isArray(rules.days) &&
    typeof rules.start_time === 'string' &&
    typeof rules.end_time === 'string' &&
    rules.start_time.match(/^\d{2}:\d{2}$/) &&
    rules.end_time.match(/^\d{2}:\d{2}$/)
  );
}

// Mapping from weekday names to the numeric index used by date-fns (0=Sunday, 1=Monday, etc.)
const dayNameToIndex: { [key: string]: number } = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Calculates the next valid date and time to schedule a call based on a schedule's rules.
 *
 * @param schedule - The call_schedules entity from the database.
 * @param startingFrom - The Date object from which to start searching. Defaults to the current time.
 * @returns A Date object in UTC representing the next valid slot, or null if no slot is found.
 */
export function getNextValidScheduleDate(
  schedule: call_schedules,
  startingFrom: Date = new Date()
): Date | null {
  // 1. Validate and parse the schedule rules
  if (!isValidScheduleRules(schedule.schedule_rules)) {
    console.error(`[schedule_utils] Invalid schedule_rules format for schedule ID ${schedule.id}:`, schedule.schedule_rules);
    return null;
  }

  const { days, start_time, end_time } = schedule.schedule_rules;
  const timeZone = schedule.time_zone;

  const validDays = new Set(days.map(day => dayNameToIndex[day.toLowerCase()]).filter(d => d !== undefined));
  if (validDays.size === 0) {
    console.error(`[schedule_utils] No valid days found in schedule ID ${schedule.id}`);
    return null; // No valid days to schedule on
  }

  const [startHour, startMinute] = start_time.split(':').map(Number);
  const [endHour, endMinute] = end_time.split(':').map(Number);

  // 2. Convert the starting point to the schedule's target time zone
  let candidateDate = toZonedTime(startingFrom, timeZone);

  // 3. Iterate day by day to find the next available slot (up to 14 days in the future)
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDay(candidateDate);

    // Check if the current candidate day is a valid day for calling
    if (validDays.has(dayOfWeek)) {
      // Define the start and end of the business hours window for this day
      const windowStart = set(startOfDay(candidateDate), { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
      const windowEnd = set(startOfDay(candidateDate), { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });

      // Case A: The candidate time is before the window starts today.
      // The next valid time is the start of today's window.
      if (isBefore(candidateDate, windowStart)) {
        return fromZonedTime(windowStart, timeZone);
      }

      // Case B: The candidate time is within today's window.
      // The next valid time is right now.
      if (!isAfter(candidateDate, windowEnd)) {
        return fromZonedTime(candidateDate, timeZone);
      }

      // Case C: The candidate time is after today's window has already closed.
      // We'll proceed to the next day by letting the loop continue.
    }

    // If we're here, it's either an invalid day or we're past today's window.
    // Advance the candidate to the start of the next day and check again.
    candidateDate = startOfDay(addDays(candidateDate, 1));
  }

  // 4. If no valid date was found within the search window, return null.
  console.warn(`[schedule_utils] Could not find a valid schedule slot within 14 days for schedule ${schedule.id}`);
  return null;
}