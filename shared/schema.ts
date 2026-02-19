import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role").notNull(),
  color: text("color").notNull(),
  initials: text("initials").notNull(),
  phone: text("phone"),
  email: text("email"),
  responsibilities: text("responsibilities"),
  sortOrder: integer("sort_order").default(0),
});

export const episodes = pgTable("episodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planning"),
  scheduledDate: date("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  episodeNumber: integer("episode_number"),
  interviewId: varchar("interview_id"),
  recordingLink: text("recording_link"),
  timestampsJson: text("timestamps_json"),
  aiStatus: text("ai_status"),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").notNull(),
  assigneeId: varchar("assignee_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("todo"),
  dueDate: date("due_date"),
});

export const studioDates = pgTable("studio_dates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  status: text("status").notNull().default("available"),
  notes: text("notes"),
  bookedSlot: text("booked_slot"),
  participantEmails: text("participant_emails"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const guests = pgTable("guests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  shortDescription: text("short_description"),
  notes: text("notes"),
  status: text("status").notNull().default("prospect"),
  links: text("links").array(),
  addedBy: varchar("added_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const interviews = pgTable("interviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guestId: varchar("guest_id").notNull(),
  studioDateId: varchar("studio_date_id"),
  scheduledDate: date("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  location: text("location"),
  status: text("status").notNull().default("proposed"),
  notes: text("notes"),
  confirmedBy: varchar("confirmed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const interviewParticipants = pgTable("interview_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  interviewId: varchar("interview_id").notNull(),
  teamMemberId: varchar("team_member_id").notNull(),
  role: text("role").notNull().default("interviewer"),
});

export const publishing = pgTable("publishing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").notNull(),
  platform: text("platform").notNull(),
  scheduledDate: date("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  status: text("status").notNull().default("scheduled"),
  title: text("title"),
  description: text("description"),
  externalUrl: text("external_url"),
});

export const reminders = pgTable("reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  targetType: text("target_type").notNull().default("whatsapp"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("pending"),
  payload: text("payload"),
  relatedId: varchar("related_id"),
  sentAt: timestamp("sent_at"),
});

export const episodeFiles = pgTable("episode_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("document"),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const episodeShorts = pgTable("episode_shorts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").notNull(),
  title: text("title").notNull(),
  objectPath: text("object_path"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sharedLinks = pgTable("shared_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertEpisodeSchema = createInsertSchema(episodes).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export const insertStudioDateSchema = createInsertSchema(studioDates).omit({ id: true, updatedAt: true });
export const insertGuestSchema = createInsertSchema(guests).omit({ id: true, createdAt: true });
export const insertInterviewSchema = createInsertSchema(interviews).omit({ id: true, createdAt: true });
export const insertInterviewParticipantSchema = createInsertSchema(interviewParticipants).omit({ id: true });
export const insertPublishingSchema = createInsertSchema(publishing).omit({ id: true });
export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true, sentAt: true });
export const insertEpisodeFileSchema = createInsertSchema(episodeFiles).omit({ id: true, uploadedAt: true });
export const insertEpisodeShortSchema = createInsertSchema(episodeShorts).omit({ id: true, createdAt: true });
export const insertSharedLinkSchema = createInsertSchema(sharedLinks).omit({ id: true, createdAt: true });

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;
export type Episode = typeof episodes.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertStudioDate = z.infer<typeof insertStudioDateSchema>;
export type StudioDate = typeof studioDates.$inferSelect;
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type Guest = typeof guests.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterviewParticipant = z.infer<typeof insertInterviewParticipantSchema>;
export type InterviewParticipant = typeof interviewParticipants.$inferSelect;
export type InsertPublishing = z.infer<typeof insertPublishingSchema>;
export type Publishing = typeof publishing.$inferSelect;
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;
export type InsertEpisodeFile = z.infer<typeof insertEpisodeFileSchema>;
export type EpisodeFile = typeof episodeFiles.$inferSelect;
export type InsertEpisodeShort = z.infer<typeof insertEpisodeShortSchema>;
export type EpisodeShort = typeof episodeShorts.$inferSelect;
export type InsertSharedLink = z.infer<typeof insertSharedLinkSchema>;
export type SharedLink = typeof sharedLinks.$inferSelect;
