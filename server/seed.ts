import { db } from "./db";
import { teamMembers, episodes, tasks, studioDates } from "@shared/schema";
import { sql } from "drizzle-orm";
import { addDays, format } from "date-fns";

export async function seedDatabase() {
  const existingMembers = await db.select().from(teamMembers);
  if (existingMembers.length > 0) return;

  console.log("Seeding database...");

  const memberData = [
    { name: "Alex Rivera", role: "Host", color: "#3b82f6", initials: "AR" },
    { name: "Jordan Chen", role: "Co-Host", color: "#ef4444", initials: "JC" },
    { name: "Sam Taylor", role: "Producer", color: "#10b981", initials: "ST" },
    { name: "Morgan Lee", role: "Audio Engineer", color: "#f59e0b", initials: "ML" },
    { name: "Casey Brooks", role: "Editor", color: "#8b5cf6", initials: "CB" },
    { name: "Riley Kim", role: "Researcher", color: "#ec4899", initials: "RK" },
    { name: "Drew Patel", role: "Social Media", color: "#06b6d4", initials: "DP" },
    { name: "Jamie Ortiz", role: "Graphic Designer", color: "#f97316", initials: "JO" },
    { name: "Quinn Davis", role: "Marketing", color: "#6366f1", initials: "QD" },
  ];

  const insertedMembers = await db.insert(teamMembers).values(memberData).returning();

  const today = new Date();

  const episodeData = [
    { title: "The Future of Remote Work", description: "Exploring how remote work is reshaping industries", status: "editing", episodeNumber: 41, scheduledDate: format(addDays(today, -3), "yyyy-MM-dd") },
    { title: "AI in Everyday Life", description: "How artificial intelligence is becoming part of our daily routines", status: "recording", episodeNumber: 42, scheduledDate: format(addDays(today, 5), "yyyy-MM-dd") },
    { title: "Building Creative Teams", description: "Strategies for assembling and leading creative teams", status: "scheduled", episodeNumber: 43, scheduledDate: format(addDays(today, 12), "yyyy-MM-dd") },
    { title: "The Podcast Economy", description: "Understanding monetization and the business side of podcasting", status: "planning", episodeNumber: 44, scheduledDate: format(addDays(today, 20), "yyyy-MM-dd") },
    { title: "Mental Health at Work", description: "Conversations about workplace wellness and mental health", status: "published", episodeNumber: 40, scheduledDate: format(addDays(today, -14), "yyyy-MM-dd") },
  ];

  const insertedEpisodes = await db.insert(episodes).values(episodeData).returning();

  const taskData = [
    { episodeId: insertedEpisodes[0].id, assigneeId: insertedMembers[4].id, title: "Final audio edit", status: "in_progress", dueDate: format(addDays(today, 1), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[0].id, assigneeId: insertedMembers[7].id, title: "Design episode cover art", status: "todo", dueDate: format(addDays(today, 2), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[0].id, assigneeId: insertedMembers[6].id, title: "Write social media posts", status: "todo", dueDate: format(addDays(today, 3), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: insertedMembers[5].id, title: "Research guest background", status: "done", dueDate: format(addDays(today, -1), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: insertedMembers[0].id, title: "Prepare interview questions", status: "in_progress", dueDate: format(addDays(today, 3), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: insertedMembers[2].id, title: "Book studio session", status: "done", dueDate: format(addDays(today, 1), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: insertedMembers[3].id, title: "Set up recording equipment", status: "todo", dueDate: format(addDays(today, 4), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[2].id, assigneeId: insertedMembers[5].id, title: "Topic research and outline", status: "in_progress", dueDate: format(addDays(today, 8), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[2].id, assigneeId: insertedMembers[2].id, title: "Confirm guest availability", status: "todo", dueDate: format(addDays(today, 7), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[3].id, assigneeId: insertedMembers[5].id, title: "Initial topic research", status: "todo", dueDate: format(addDays(today, 14), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[3].id, assigneeId: insertedMembers[8].id, title: "Plan marketing campaign", status: "todo", dueDate: format(addDays(today, 16), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[4].id, assigneeId: insertedMembers[4].id, title: "Final audio mix", status: "done", dueDate: format(addDays(today, -16), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[4].id, assigneeId: insertedMembers[6].id, title: "Publish social media campaign", status: "done", dueDate: format(addDays(today, -13), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[4].id, assigneeId: insertedMembers[7].id, title: "Episode artwork", status: "done", dueDate: format(addDays(today, -15), "yyyy-MM-dd") },
  ];

  await db.insert(tasks).values(taskData);

  const studioData = [
    { date: format(addDays(today, 5), "yyyy-MM-dd"), status: "available", notes: "Full day available" },
    { date: format(addDays(today, 8), "yyyy-MM-dd"), status: "available", notes: "Morning slot only" },
    { date: format(addDays(today, 12), "yyyy-MM-dd"), status: "available", notes: "Afternoon preferred" },
    { date: format(addDays(today, 15), "yyyy-MM-dd"), status: "taken", notes: "Booked by another show" },
    { date: format(addDays(today, 19), "yyyy-MM-dd"), status: "available", notes: null },
    { date: format(addDays(today, 22), "yyyy-MM-dd"), status: "available", notes: "Evening session available" },
    { date: format(addDays(today, 26), "yyyy-MM-dd"), status: "available", notes: null },
    { date: format(addDays(today, 30), "yyyy-MM-dd"), status: "available", notes: "Full day open" },
  ];

  await db.insert(studioDates).values(studioData);

  console.log("Database seeded successfully!");
}
