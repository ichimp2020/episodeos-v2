import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTeamMemberSchema, insertEpisodeSchema, insertTaskSchema, insertStudioDateSchema } from "@shared/schema";
import { z } from "zod";

const updateEpisodeSchema = insertEpisodeSchema.partial();
const updateTaskSchema = insertTaskSchema.partial();
const updateStudioDateSchema = insertStudioDateSchema.partial();

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

  return httpServer;
}
