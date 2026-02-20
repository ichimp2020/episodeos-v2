import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertTeamMemberSchema, insertEpisodeSchema, insertTaskSchema, insertStudioDateSchema,
  insertGuestSchema, insertInterviewSchema, insertInterviewParticipantSchema,
  insertPublishingSchema, insertReminderSchema,
  insertEpisodeFileSchema, insertEpisodeShortSchema, insertInterviewerUnavailabilitySchema, insertSharedLinkSchema,
} from "@shared/schema";
import { z } from "zod";
import { createCalendarEvent } from "./google-calendar";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

const updateTeamMemberSchema = insertTeamMemberSchema.partial();
const updateEpisodeSchema = insertEpisodeSchema.partial();
const updateTaskSchema = insertTaskSchema.partial();
const updateStudioDateSchema = insertStudioDateSchema.partial();
const updateEpisodeShortSchema = insertEpisodeShortSchema.partial();
const updateGuestSchema = insertGuestSchema.partial();
const updateInterviewSchema = insertInterviewSchema.partial();
const updatePublishingSchema = insertPublishingSchema.partial();
const updateReminderSchema = insertReminderSchema.partial();
const updateSharedLinkSchema = insertSharedLinkSchema.partial();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/settings", (_req, res) => {
    res.json({ podcastName: process.env.PODCAST_NAME || "My Podcast" });
  });

  app.get("/api/team-members", async (_req, res) => {
    const members = await storage.getTeamMembers();
    res.json(members);
  });

  app.post("/api/team-members", async (req, res) => {
    const parsed = insertTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const member = await storage.createTeamMember(parsed.data);
    res.status(201).json(member);
  });

  app.patch("/api/team-members/:id", async (req, res) => {
    const parsed = updateTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateTeamMember(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Member not found" });
    res.json(updated);
  });

  app.delete("/api/team-members/:id", async (req, res) => {
    await storage.deleteTeamMember(req.params.id);
    res.status(204).send();
  });

  app.get("/api/episodes", async (_req, res) => {
    const eps = await storage.getEpisodes();
    res.json(eps);
  });

  app.post("/api/episodes", async (req, res) => {
    const parsed = insertEpisodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const episode = await storage.createEpisode(parsed.data);

    const allMembers = await storage.getTeamMembers();
    const findIds = (names: string[]) =>
      allMembers.filter((m) => names.some((n) => m.name.toLowerCase() === n.toLowerCase())).map((m) => m.id);

    const defaultTasks = [
      { title: "Episode Title", assigneeIds: findIds(["Gal", "Homsie"]) },
      { title: "Description Context", assigneeIds: findIds(["Gal", "Homsie"]) },
      { title: "Graphics", assigneeIds: findIds(["Yair", "Yuli"]) },
      { title: "Teasers", assigneeIds: findIds(["Knob"]) },
      { title: "Final Edit for Upload", assigneeIds: findIds(["Knob"]) },
    ];

    for (const dt of defaultTasks) {
      await storage.createTask({
        episodeId: episode.id,
        title: dt.title,
        assigneeIds: dt.assigneeIds,
        status: "todo",
      });
    }

    res.status(201).json(episode);
  });

  app.patch("/api/episodes/:id", async (req, res) => {
    const parsed = updateEpisodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateEpisode(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Episode not found" });
    res.json(updated);
  });

  app.delete("/api/episodes/:id", async (req, res) => {
    await storage.deleteEpisode(req.params.id);
    res.status(204).send();
  });

  app.get("/api/tasks", async (_req, res) => {
    const allTasks = await storage.getTasks();
    res.json(allTasks);
  });

  app.post("/api/tasks", async (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const task = await storage.createTask(parsed.data);
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateTask(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    res.json(updated);
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    await storage.deleteTask(req.params.id);
    res.status(204).send();
  });

  app.get("/api/studio-dates", async (_req, res) => {
    const dates = await storage.getStudioDates();
    res.json(dates);
  });

  app.post("/api/studio-dates", async (req, res) => {
    const parsed = insertStudioDateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const date = await storage.createStudioDate(parsed.data);
    res.status(201).json(date);
  });

  app.post("/api/studio-dates/bulk", async (req, res) => {
    const { dates } = req.body;
    if (!Array.isArray(dates)) return res.status(400).json({ message: "dates must be an array" });
    const results = [];
    for (const item of dates) {
      const parsed = insertStudioDateSchema.safeParse(item);
      if (parsed.success) {
        const created = await storage.createStudioDate(parsed.data);
        results.push(created);
      }
    }
    res.status(201).json(results);
  });

  app.patch("/api/studio-dates/:id", async (req, res) => {
    const parsed = updateStudioDateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateStudioDate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Studio date not found" });
    res.json(updated);
  });

  app.delete("/api/studio-dates/:id", async (req, res) => {
    await storage.deleteStudioDate(req.params.id);
    res.status(204).send();
  });

  app.get("/api/guests", async (_req, res) => {
    const allGuests = await storage.getGuests();
    res.json(allGuests);
  });

  app.get("/api/guests/:id", async (req, res) => {
    const guest = await storage.getGuest(req.params.id);
    if (!guest) return res.status(404).json({ message: "Guest not found" });
    res.json(guest);
  });

  app.post("/api/guests", async (req, res) => {
    const parsed = insertGuestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const guestData = { ...parsed.data };
    if ((!guestData.status || guestData.status === "prospect") && !guestData.addedBy) {
      const members = await storage.getTeamMembers();
      const sharon = members.find((m) => m.name.toLowerCase().includes("sharon"));
      if (sharon) {
        guestData.addedBy = sharon.id;
      }
    }
    const guest = await storage.createGuest(guestData);
    res.status(201).json(guest);
  });

  app.patch("/api/guests/:id", async (req, res) => {
    const parsed = updateGuestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const previousGuest = await storage.getGuest(req.params.id);
    if (!previousGuest) return res.status(404).json({ message: "Guest not found" });

    const updated = await storage.updateGuest(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Guest not found" });

    if (parsed.data.status === "confirmed" && previousGuest.status !== "confirmed") {
      const allEpisodes = await storage.getEpisodes();
      const alreadyExists = allEpisodes.some((e) => e.title === updated.name);
      if (!alreadyExists) {
      const maxEpNum = allEpisodes.reduce((max, ep) => Math.max(max, ep.episodeNumber || 0), 0);

      const episode = await storage.createEpisode({
        title: updated.name,
        description: `Interview with ${updated.name}`,
        status: "planning",
        scheduledDate: null,
        scheduledTime: null,
        episodeNumber: maxEpNum + 1,
        interviewId: null,
        recordingLink: null,
        timestampsJson: null,
        aiStatus: null,
      });

      const allMembers = await storage.getTeamMembers();
      const findIds = (names: string[]) =>
        allMembers.filter((m) => names.some((n) => m.name.toLowerCase() === n.toLowerCase())).map((m) => m.id);

      const defaultTasks = [
        { title: "Episode Title", assigneeIds: findIds(["Gal", "Homsie"]) },
        { title: "Description Context", assigneeIds: findIds(["Gal", "Homsie"]) },
        { title: "Graphics", assigneeIds: findIds(["Yair", "Yuli"]) },
        { title: "Teasers", assigneeIds: findIds(["Knob"]) },
        { title: "Final Edit for Upload", assigneeIds: findIds(["Knob"]) },
      ];

      for (const dt of defaultTasks) {
        await storage.createTask({
          episodeId: episode.id,
          title: dt.title,
          assigneeIds: dt.assigneeIds,
          status: "todo",
        });
      }
      }
    }

    res.json(updated);
  });

  app.delete("/api/guests/:id", async (req, res) => {
    await storage.deleteGuest(req.params.id);
    res.status(204).send();
  });

  app.get("/api/interviews", async (_req, res) => {
    const allInterviews = await storage.getInterviews();
    res.json(allInterviews);
  });

  app.get("/api/interviews/:id", async (req, res) => {
    const interview = await storage.getInterview(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    res.json(interview);
  });

  app.post("/api/interviews", async (req, res) => {
    const parsed = insertInterviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const interview = await storage.createInterview(parsed.data);

    if (parsed.data.studioDateId) {
      await storage.updateStudioDate(parsed.data.studioDateId, { status: "taken" });
    }

    if (parsed.data.scheduledDate) {
      const interviewDate = new Date(parsed.data.scheduledDate);
      const reminderDate = new Date(interviewDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(10, 0, 0, 0);

      await storage.createReminder({
        type: "interview_24h",
        targetType: "whatsapp",
        scheduledAt: reminderDate,
        status: "pending",
        payload: JSON.stringify({ interviewId: interview.id }),
        relatedId: interview.id,
      });
    }

    res.status(201).json(interview);
  });

  app.patch("/api/interviews/:id", async (req, res) => {
    const parsed = updateInterviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const existing = await storage.getInterview(req.params.id);
    if (!existing) return res.status(404).json({ message: "Interview not found" });

    const updated = await storage.updateInterview(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Interview not found" });

    if (parsed.data.status === "confirmed" && existing.status !== "confirmed") {
      const existingEpisodes = await storage.getEpisodes();
      const alreadyLinked = existingEpisodes.some((e) => e.interviewId === req.params.id);
      if (!alreadyLinked) {
        const guest = updated.guestId ? await storage.getGuest(updated.guestId) : null;
        const guestName = guest?.name || "Guest";
        const maxEpNum = existingEpisodes.reduce((max, e) => Math.max(max, e.episodeNumber || 0), 0);
        await storage.createEpisode({
          title: guestName,
          description: `Interview with ${guestName}`,
          status: "scheduled",
          scheduledDate: updated.scheduledDate || null,
          scheduledTime: updated.scheduledTime || null,
          episodeNumber: maxEpNum + 1,
          interviewId: req.params.id,
          recordingLink: null,
          timestampsJson: null,
          aiStatus: null,
        });
      }
    }

    res.json(updated);
  });

  app.delete("/api/interviews/:id", async (req, res) => {
    await storage.deleteInterview(req.params.id);
    res.status(204).send();
  });

  app.get("/api/interviews/:id/participants", async (req, res) => {
    const participants = await storage.getInterviewParticipants(req.params.id);
    res.json(participants);
  });

  app.post("/api/interview-participants", async (req, res) => {
    const parsed = insertInterviewParticipantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const participant = await storage.createInterviewParticipant(parsed.data);
    res.status(201).json(participant);
  });

  app.delete("/api/interview-participants/:id", async (req, res) => {
    await storage.deleteInterviewParticipant(req.params.id);
    res.status(204).send();
  });

  app.get("/api/interviewer-unavailability", async (_req, res) => {
    const entries = await storage.getInterviewerUnavailability();
    res.json(entries);
  });

  app.post("/api/interviewer-unavailability", async (req, res) => {
    const parsed = insertInterviewerUnavailabilitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entry = await storage.createInterviewerUnavailability(parsed.data);
    res.status(201).json(entry);
  });

  app.delete("/api/interviewer-unavailability/:id", async (req, res) => {
    await storage.deleteInterviewerUnavailability(req.params.id);
    res.status(204).send();
  });

  app.post("/api/interviewer-unavailability/toggle", async (req, res) => {
    const { teamMemberId, unavailableDate, slotLabel } = req.body;
    if (!teamMemberId || !unavailableDate) {
      return res.status(400).json({ message: "teamMemberId and unavailableDate required" });
    }
    const all = await storage.getInterviewerUnavailability();
    const existing = all.find(e =>
      e.teamMemberId === teamMemberId &&
      e.unavailableDate === unavailableDate &&
      (slotLabel ? e.slotLabel === slotLabel : !e.slotLabel)
    );
    if (existing) {
      await storage.deleteInterviewerUnavailability(existing.id);
      res.json({ action: "removed" });
    } else {
      const entry = await storage.createInterviewerUnavailability({
        teamMemberId,
        unavailableDate,
        slotLabel: slotLabel || null,
      });
      res.json({ action: "added", entry });
    }
  });

  app.get("/api/publishing", async (_req, res) => {
    const allPub = await storage.getAllPublishing();
    res.json(allPub);
  });

  app.get("/api/publishing/episode/:episodeId", async (req, res) => {
    const pubs = await storage.getPublishingByEpisode(req.params.episodeId);
    res.json(pubs);
  });

  app.post("/api/publishing", async (req, res) => {
    const parsed = insertPublishingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const pub = await storage.createPublishing(parsed.data);
    res.status(201).json(pub);
  });

  app.patch("/api/publishing/:id", async (req, res) => {
    const parsed = updatePublishingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updatePublishing(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Publishing record not found" });
    res.json(updated);
  });

  app.delete("/api/publishing/:id", async (req, res) => {
    await storage.deletePublishing(req.params.id);
    res.status(204).send();
  });

  app.get("/api/reminders", async (_req, res) => {
    const allReminders = await storage.getReminders();
    res.json(allReminders);
  });

  app.post("/api/reminders", async (req, res) => {
    const parsed = insertReminderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const reminder = await storage.createReminder(parsed.data);
    res.status(201).json(reminder);
  });

  app.patch("/api/reminders/:id", async (req, res) => {
    const parsed = updateReminderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateReminder(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Reminder not found" });
    res.json(updated);
  });

  app.delete("/api/reminders/:id", async (req, res) => {
    await storage.deleteReminder(req.params.id);
    res.status(204).send();
  });

  const calendarEventSchema = z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    summary: z.string(),
    description: z.string().optional(),
    attendeeEmails: z.array(z.string().email()),
  });

  app.post("/api/calendar-event", async (req, res) => {
    const parsed = calendarEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const event = await createCalendarEvent(parsed.data);
      res.status(201).json({ id: event.id, htmlLink: event.htmlLink, status: event.status });
    } catch (err: any) {
      console.error("Google Calendar event creation failed:", err.message);
      res.status(500).json({ message: "Failed to create calendar event: " + err.message });
    }
  });

  registerObjectStorageRoutes(app);

  app.get("/api/episodes/:episodeId/files", async (req, res) => {
    const files = await storage.getEpisodeFiles(req.params.episodeId);
    res.json(files);
  });

  app.post("/api/episodes/:episodeId/files", async (req, res) => {
    const data = { ...req.body, episodeId: req.params.episodeId };
    const parsed = insertEpisodeFileSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const file = await storage.createEpisodeFile(parsed.data);
    res.status(201).json(file);
  });

  app.delete("/api/episode-files/:id", async (req, res) => {
    await storage.deleteEpisodeFile(req.params.id);
    res.status(204).send();
  });

  app.get("/api/episodes/:episodeId/shorts", async (req, res) => {
    const shorts = await storage.getEpisodeShorts(req.params.episodeId);
    res.json(shorts);
  });

  app.post("/api/episodes/:episodeId/shorts", async (req, res) => {
    const data = { ...req.body, episodeId: req.params.episodeId };
    const parsed = insertEpisodeShortSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const short = await storage.createEpisodeShort(parsed.data);
    res.status(201).json(short);
  });

  app.patch("/api/episode-shorts/:id", async (req, res) => {
    const parsed = updateEpisodeShortSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateEpisodeShort(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Short not found" });
    res.json(updated);
  });

  app.delete("/api/episode-shorts/:id", async (req, res) => {
    await storage.deleteEpisodeShort(req.params.id);
    res.status(204).send();
  });

  app.get("/api/shared-links", async (_req, res) => {
    const links = await storage.getSharedLinks();
    res.json(links);
  });

  app.post("/api/shared-links", async (req, res) => {
    const parsed = insertSharedLinkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const link = await storage.createSharedLink(parsed.data);
    res.status(201).json(link);
  });

  app.patch("/api/shared-links/:id", async (req, res) => {
    const parsed = updateSharedLinkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateSharedLink(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Link not found" });
    res.json(updated);
  });

  app.delete("/api/shared-links/:id", async (req, res) => {
    await storage.deleteSharedLink(req.params.id);
    res.status(204).send();
  });

  return httpServer;
}
