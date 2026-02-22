// Google Calendar integration via Replit connector
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

interface CalendarEventParams {
  date: string;
  startTime: string;
  endTime: string;
  summary: string;
  description?: string;
  attendeeEmails: string[];
}

function isCalendarEnabled() {
  return process.env.CALENDAR_EMAILS_ENABLED === 'true';
}

export async function createCalendarEvent(params: CalendarEventParams) {
  if (!isCalendarEnabled()) {
    console.log('[Calendar] Emails disabled — skipping event creation:', params.summary);
    return { id: `dev-mock-${Date.now()}`, status: 'skipped' };
  }
  const calendar = await getUncachableGoogleCalendarClient();

  const startDateTime = `${params.date}T${params.startTime}:00`;
  const endDateTime = `${params.date}T${params.endTime}:00`;

  const event = {
    summary: params.summary,
    description: params.description || '',
    start: {
      dateTime: startDateTime,
      timeZone: 'Asia/Jerusalem',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Asia/Jerusalem',
    },
    attendees: params.attendeeEmails.map(email => ({ email: email.trim() })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: 'all',
  });

  return response.data;
}

export async function deleteCalendarEvent(eventId: string, notify: boolean = true) {
  if (!isCalendarEnabled()) {
    console.log('[Calendar] Emails disabled — skipping event deletion:', eventId);
    return;
  }
  const calendar = await getUncachableGoogleCalendarClient();
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: notify ? 'all' : 'none',
  });
}

export async function updateCalendarEvent(eventId: string, params: CalendarEventParams) {
  if (!isCalendarEnabled()) {
    console.log('[Calendar] Emails disabled — skipping event update:', eventId, params.summary);
    return { id: eventId, status: 'skipped' };
  }
  const calendar = await getUncachableGoogleCalendarClient();

  const startDateTime = `${params.date}T${params.startTime}:00`;
  const endDateTime = `${params.date}T${params.endTime}:00`;

  const event = {
    summary: params.summary,
    description: params.description || '',
    start: {
      dateTime: startDateTime,
      timeZone: 'Asia/Jerusalem',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Asia/Jerusalem',
    },
    attendees: params.attendeeEmails.map(email => ({ email: email.trim() })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId,
    requestBody: event,
    sendUpdates: 'all',
  });

  return response.data;
}
