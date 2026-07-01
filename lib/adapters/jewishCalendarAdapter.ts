import { HDate, HebrewCalendar, Location } from '@hebcal/core';

export const jewishCalendarAdapter = {
  getStatus() {
    try {
      const now = new Date();
      const hdate = new HDate(now);
      const year = hdate.getFullYear();
      
      if (year < 5000 || year > 6000) {
        throw new Error(`Suspicious Hebrew year detected: ${year}`);
      }
      
      return {
        isConfigured: true,
        error: null,
        details: {
          today: hdate.toString(),
          year: year
        }
      };
    } catch (err) {
      return {
        isConfigured: false,
        error: err instanceof Error ? err.message : 'Hebcal library error',
      };
    }
  },

  getTodayInfo() {
    const now = new Date();
    const hdate = new HDate(now);
    const location = Location.lookup('New York'); // Default to NYC
    const options = {
      location: location,
      isHebrewYear: true,
      candlelighting: true,
      sedrot: true,
      holidays: true,
      hdate: hdate
    };
    const events = HebrewCalendar.calendar(options);
    return {
      hdate: hdate.toString(),
      events: events.map(ev => ({
        title: ev.render(),
        desc: ev.getDesc(),
        category: ev.getCategories()
      }))
    };
  }
};
