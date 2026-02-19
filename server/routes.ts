import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertTeamMemberSchema, insertEpisodeSchema, insertTaskSchema, insertStudioDateSchema,
  insertGuestSchema, insertInterviewSchema, insertInterviewParticipantSchema,
  insertPublishingSchema, insertReminderSchema,
} from "@shared/schema";
import { z } from "zod";

const updateEpisodeSchema = insertEpisodeSchema.partial();
const updateTaskSchema = insertTaskSchema.partial();
const updateStudioDateSchema = insertStudioDateSchema.partial();
const updateGuestSchema = insertGuestSchema.partial();
const updateInterviewSchema = insertInterviewSchema.partial();
const updatePublishingSchema = insertPublishingSchema.partial();
const updateReminderSchema = insertReminderSchema.partial();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
    const guest = await storage.createGuest(parsed.data);
    res.status(201).json(guest);
  });

  app.patch("/api/guests/:id", async (req, res) => {
    const parsed = updateGuestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateGuest(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Guest not found" });
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
    const updated = await storage.updateInterview(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Interview not found" });
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

  return httpServer;
}
