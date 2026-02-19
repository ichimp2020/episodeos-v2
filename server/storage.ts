import {
  type TeamMember, type InsertTeamMember,
  type Episode, type InsertEpisode,
  type Task, type InsertTask,
  type StudioDate, type InsertStudioDate,
  teamMembers, episodes, tasks, studioDates,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getTeamMembers(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<void>;

  getEpisodes(): Promise<Episode[]>;
  getEpisode(id: string): Promise<Episode | undefined>;
  createEpisode(episode: InsertEpisode): Promise<Episode>;
  updateEpisode(id: string, data: Partial<InsertEpisode>): Promise<Episode | undefined>;
  deleteEpisode(id: string): Promise<void>;

  getTasks(): Promise<Task[]>;
  getTasksByEpisode(episodeId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  getStudioDates(): Promise<StudioDate[]>;
  createStudioDate(date: InsertStudioDate): Promise<StudioDate>;
  updateStudioDate(id: string, data: Partial<InsertStudioDate>): Promise<StudioDate | undefined>;
  deleteStudioDate(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTeamMembers(): Promise<TeamMember[]> {
    return db.select().from(teamMembers);
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return member;
  }

  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }

  async deleteTeamMember(id: string): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  async getEpisodes(): Promise<Episode[]> {
    return db.select().from(episodes);
  }

  async getEpisode(id: string): Promise<Episode | undefined> {
    const [episode] = await db.select().from(episodes).where(eq(episodes.id, id));
    return episode;
  }

  async createEpisode(episode: InsertEpisode): Promise<Episode> {
    const [created] = await db.insert(episodes).values(episode).returning();
    return created;
  }

  async updateEpisode(id: string, data: Partial<InsertEpisode>): Promise<Episode | undefined> {
    const [updated] = await db.update(episodes).set(data).where(eq(episodes.id, id)).returning();
    return updated;
  }

  async deleteEpisode(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.episodeId, id));
    await db.delete(episodes).where(eq(episodes.id, id));
  }

  async getTasks(): Promise<Task[]> {
    return db.select().from(tasks);
  }

  async getTasksByEpisode(episodeId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.episodeId, episodeId));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getStudioDates(): Promise<StudioDate[]> {
    return db.select().from(studioDates);
  }

  async createStudioDate(date: InsertStudioDate): Promise<StudioDate> {
    const [created] = await db.insert(studioDates).values(date).returning();
    return created;
  }

  async updateStudioDate(id: string, data: Partial<InsertStudioDate>): Promise<StudioDate | undefined> {
    const [updated] = await db.update(studioDates).set(data).where(eq(studioDates.id, id)).returning();
    return updated;
  }

  async deleteStudioDate(id: string): Promise<void> {
    await db.delete(studioDates).where(eq(studioDates.id, id));
  }
}

export const storage = new DatabaseStorage();
