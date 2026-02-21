import {
  type TeamMember, type InsertTeamMember,
  type Episode, type InsertEpisode,
  type Task, type InsertTask,
  type StudioDate, type InsertStudioDate,
  type Guest, type InsertGuest,
  type Interview, type InsertInterview,
  type InterviewParticipant, type InsertInterviewParticipant,
  type Publishing, type InsertPublishing,
  type Reminder, type InsertReminder,
  type EpisodeFile, type InsertEpisodeFile,
  type EpisodeShort, type InsertEpisodeShort,
  type EpisodeLargeLink, type InsertEpisodeLargeLink,
  type InterviewerUnavailability, type InsertInterviewerUnavailability,
  type SharedLink, type InsertSharedLink,
  teamMembers, episodes, tasks, studioDates,
  guests, interviews, interviewParticipants, publishing, reminders,
  episodeFiles, episodeShorts, episodeLargeLinks, interviewerUnavailability, sharedLinks,
} from "@shared/schema";
import { db } from "./db";
import { eq, lte, and } from "drizzle-orm";

export interface IStorage {
  getTeamMembers(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
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

  getGuests(): Promise<Guest[]>;
  getGuest(id: string): Promise<Guest | undefined>;
  createGuest(guest: InsertGuest): Promise<Guest>;
  updateGuest(id: string, data: Partial<InsertGuest>): Promise<Guest | undefined>;
  deleteGuest(id: string): Promise<void>;

  getInterviews(): Promise<Interview[]>;
  getInterview(id: string): Promise<Interview | undefined>;
  createInterview(interview: InsertInterview): Promise<Interview>;
  updateInterview(id: string, data: Partial<InsertInterview>): Promise<Interview | undefined>;
  deleteInterview(id: string): Promise<void>;

  getInterviewParticipants(interviewId: string): Promise<InterviewParticipant[]>;
  createInterviewParticipant(participant: InsertInterviewParticipant): Promise<InterviewParticipant>;
  deleteInterviewParticipant(id: string): Promise<void>;
  deleteInterviewParticipantsByInterview(interviewId: string): Promise<void>;

  getPublishingByEpisode(episodeId: string): Promise<Publishing[]>;
  getAllPublishing(): Promise<Publishing[]>;
  createPublishing(pub: InsertPublishing): Promise<Publishing>;
  updatePublishing(id: string, data: Partial<InsertPublishing>): Promise<Publishing | undefined>;
  deletePublishing(id: string): Promise<void>;

  getReminders(): Promise<Reminder[]>;
  getPendingReminders(beforeDate: Date): Promise<Reminder[]>;
  createReminder(reminder: InsertReminder): Promise<Reminder>;
  updateReminder(id: string, data: Partial<InsertReminder>): Promise<Reminder | undefined>;
  deleteReminder(id: string): Promise<void>;

  getEpisodeFiles(episodeId: string): Promise<EpisodeFile[]>;
  createEpisodeFile(file: InsertEpisodeFile): Promise<EpisodeFile>;
  deleteEpisodeFile(id: string): Promise<void>;

  getEpisodeShorts(episodeId: string): Promise<EpisodeShort[]>;
  createEpisodeShort(short: InsertEpisodeShort): Promise<EpisodeShort>;
  updateEpisodeShort(id: string, data: Partial<InsertEpisodeShort>): Promise<EpisodeShort | undefined>;
  deleteEpisodeShort(id: string): Promise<void>;

  getEpisodeLargeLinks(episodeId: string): Promise<EpisodeLargeLink[]>;
  createEpisodeLargeLink(link: InsertEpisodeLargeLink): Promise<EpisodeLargeLink>;
  deleteEpisodeLargeLink(id: string): Promise<void>;

  getInterviewerUnavailability(): Promise<InterviewerUnavailability[]>;
  createInterviewerUnavailability(entry: InsertInterviewerUnavailability): Promise<InterviewerUnavailability>;
  deleteInterviewerUnavailability(id: string): Promise<void>;
  deleteInterviewerUnavailabilityByMemberAndDate(teamMemberId: string, unavailableDate: string, slotLabel?: string | null): Promise<void>;

  getSharedLinks(): Promise<SharedLink[]>;
  createSharedLink(link: InsertSharedLink): Promise<SharedLink>;
  updateSharedLink(id: string, data: Partial<InsertSharedLink>): Promise<SharedLink | undefined>;
  deleteSharedLink(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTeamMembers(): Promise<TeamMember[]> {
    return db.select().from(teamMembers).orderBy(teamMembers.sortOrder);
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return member;
  }

  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }

  async updateTeamMember(id: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [updated] = await db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning();
    return updated;
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
    await db.delete(publishing).where(eq(publishing.episodeId, id));
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

  async getGuests(): Promise<Guest[]> {
    return db.select().from(guests);
  }

  async getGuest(id: string): Promise<Guest | undefined> {
    const [guest] = await db.select().from(guests).where(eq(guests.id, id));
    return guest;
  }

  async createGuest(guest: InsertGuest): Promise<Guest> {
    const [created] = await db.insert(guests).values(guest).returning();
    return created;
  }

  async updateGuest(id: string, data: Partial<InsertGuest>): Promise<Guest | undefined> {
    const [updated] = await db.update(guests).set(data).where(eq(guests.id, id)).returning();
    return updated;
  }

  async deleteGuest(id: string): Promise<void> {
    await db.delete(guests).where(eq(guests.id, id));
  }

  async getInterviews(): Promise<Interview[]> {
    return db.select().from(interviews);
  }

  async getInterview(id: string): Promise<Interview | undefined> {
    const [interview] = await db.select().from(interviews).where(eq(interviews.id, id));
    return interview;
  }

  async createInterview(interview: InsertInterview): Promise<Interview> {
    const [created] = await db.insert(interviews).values(interview).returning();
    return created;
  }

  async updateInterview(id: string, data: Partial<InsertInterview>): Promise<Interview | undefined> {
    const [updated] = await db.update(interviews).set(data).where(eq(interviews.id, id)).returning();
    return updated;
  }

  async deleteInterview(id: string): Promise<void> {
    await db.delete(interviewParticipants).where(eq(interviewParticipants.interviewId, id));
    await db.delete(interviews).where(eq(interviews.id, id));
  }

  async getInterviewParticipants(interviewId: string): Promise<InterviewParticipant[]> {
    return db.select().from(interviewParticipants).where(eq(interviewParticipants.interviewId, interviewId));
  }

  async createInterviewParticipant(participant: InsertInterviewParticipant): Promise<InterviewParticipant> {
    const [created] = await db.insert(interviewParticipants).values(participant).returning();
    return created;
  }

  async deleteInterviewParticipant(id: string): Promise<void> {
    await db.delete(interviewParticipants).where(eq(interviewParticipants.id, id));
  }

  async deleteInterviewParticipantsByInterview(interviewId: string): Promise<void> {
    await db.delete(interviewParticipants).where(eq(interviewParticipants.interviewId, interviewId));
  }

  async getPublishingByEpisode(episodeId: string): Promise<Publishing[]> {
    return db.select().from(publishing).where(eq(publishing.episodeId, episodeId));
  }

  async getAllPublishing(): Promise<Publishing[]> {
    return db.select().from(publishing);
  }

  async createPublishing(pub: InsertPublishing): Promise<Publishing> {
    const [created] = await db.insert(publishing).values(pub).returning();
    return created;
  }

  async updatePublishing(id: string, data: Partial<InsertPublishing>): Promise<Publishing | undefined> {
    const [updated] = await db.update(publishing).set(data).where(eq(publishing.id, id)).returning();
    return updated;
  }

  async deletePublishing(id: string): Promise<void> {
    await db.delete(publishing).where(eq(publishing.id, id));
  }

  async getReminders(): Promise<Reminder[]> {
    return db.select().from(reminders);
  }

  async getPendingReminders(beforeDate: Date): Promise<Reminder[]> {
    return db.select().from(reminders).where(
      and(
        eq(reminders.status, "pending"),
        lte(reminders.scheduledAt, beforeDate)
      )
    );
  }

  async createReminder(reminder: InsertReminder): Promise<Reminder> {
    const [created] = await db.insert(reminders).values(reminder).returning();
    return created;
  }

  async updateReminder(id: string, data: Partial<InsertReminder>): Promise<Reminder | undefined> {
    const [updated] = await db.update(reminders).set(data).where(eq(reminders.id, id)).returning();
    return updated;
  }

  async deleteReminder(id: string): Promise<void> {
    await db.delete(reminders).where(eq(reminders.id, id));
  }

  async getEpisodeFiles(episodeId: string): Promise<EpisodeFile[]> {
    return db.select().from(episodeFiles).where(eq(episodeFiles.episodeId, episodeId));
  }

  async createEpisodeFile(file: InsertEpisodeFile): Promise<EpisodeFile> {
    const [created] = await db.insert(episodeFiles).values(file).returning();
    return created;
  }

  async deleteEpisodeFile(id: string): Promise<void> {
    await db.delete(episodeFiles).where(eq(episodeFiles.id, id));
  }

  async getEpisodeShorts(episodeId: string): Promise<EpisodeShort[]> {
    return db.select().from(episodeShorts).where(eq(episodeShorts.episodeId, episodeId));
  }

  async createEpisodeShort(short: InsertEpisodeShort): Promise<EpisodeShort> {
    const [created] = await db.insert(episodeShorts).values(short).returning();
    return created;
  }

  async updateEpisodeShort(id: string, data: Partial<InsertEpisodeShort>): Promise<EpisodeShort | undefined> {
    const [updated] = await db.update(episodeShorts).set(data).where(eq(episodeShorts.id, id)).returning();
    return updated;
  }

  async deleteEpisodeShort(id: string): Promise<void> {
    await db.delete(episodeShorts).where(eq(episodeShorts.id, id));
  }

  async getEpisodeLargeLinks(episodeId: string): Promise<EpisodeLargeLink[]> {
    return db.select().from(episodeLargeLinks).where(eq(episodeLargeLinks.episodeId, episodeId));
  }

  async createEpisodeLargeLink(link: InsertEpisodeLargeLink): Promise<EpisodeLargeLink> {
    const [created] = await db.insert(episodeLargeLinks).values(link).returning();
    return created;
  }

  async deleteEpisodeLargeLink(id: string): Promise<void> {
    await db.delete(episodeLargeLinks).where(eq(episodeLargeLinks.id, id));
  }

  async getInterviewerUnavailability(): Promise<InterviewerUnavailability[]> {
    return db.select().from(interviewerUnavailability);
  }

  async createInterviewerUnavailability(entry: InsertInterviewerUnavailability): Promise<InterviewerUnavailability> {
    const [created] = await db.insert(interviewerUnavailability).values(entry).returning();
    return created;
  }

  async deleteInterviewerUnavailability(id: string): Promise<void> {
    await db.delete(interviewerUnavailability).where(eq(interviewerUnavailability.id, id));
  }

  async deleteInterviewerUnavailabilityByMemberAndDate(teamMemberId: string, unavailableDate: string, slotLabel?: string | null): Promise<void> {
    if (slotLabel) {
      await db.delete(interviewerUnavailability).where(
        and(
          eq(interviewerUnavailability.teamMemberId, teamMemberId),
          eq(interviewerUnavailability.unavailableDate, unavailableDate),
          eq(interviewerUnavailability.slotLabel, slotLabel)
        )
      );
    } else {
      await db.delete(interviewerUnavailability).where(
        and(
          eq(interviewerUnavailability.teamMemberId, teamMemberId),
          eq(interviewerUnavailability.unavailableDate, unavailableDate)
        )
      );
    }
  }

  async getSharedLinks(): Promise<SharedLink[]> {
    return db.select().from(sharedLinks);
  }

  async createSharedLink(link: InsertSharedLink): Promise<SharedLink> {
    const [created] = await db.insert(sharedLinks).values(link).returning();
    return created;
  }

  async updateSharedLink(id: string, data: Partial<InsertSharedLink>): Promise<SharedLink | undefined> {
    const [updated] = await db.update(sharedLinks).set(data).where(eq(sharedLinks.id, id)).returning();
    return updated;
  }

  async deleteSharedLink(id: string): Promise<void> {
    await db.delete(sharedLinks).where(eq(sharedLinks.id, id));
  }
}

export const storage = new DatabaseStorage();
