import { db } from "./db";
import { teamMembers, episodes, tasks, studioDates, guests, interviews, interviewParticipants } from "@shared/schema";
import { sql } from "drizzle-orm";
import { addDays, format } from "date-fns";

export async function seedDatabase() {
  const existingMembers = await db.select().from(teamMembers);
  if (existingMembers.length > 0) return;

  console.log("Seeding database...");

  const memberData = [
    { name: "Reef", role: "CEO", color: "#3b82f6", initials: "RF" },
    { name: "Sharon", role: "Office Manager", color: "#ec4899", initials: "SH" },
    { name: "Gal", role: "Interviewer", color: "#10b981", initials: "GL" },
    { name: "Zion", role: "Interviewer", color: "#f59e0b", initials: "ZN" },
    { name: "Casey Brooks", role: "Editor", color: "#8b5cf6", initials: "CB" },
    { name: "Morgan Lee", role: "Audio Engineer", color: "#ef4444", initials: "ML" },
    { name: "Drew Patel", role: "Social Media", color: "#06b6d4", initials: "DP" },
    { name: "Jamie Ortiz", role: "Graphic Designer", color: "#f97316", initials: "JO" },
    { name: "Quinn Davis", role: "Marketing", color: "#6366f1", initials: "QD" },
  ];

  const insertedMembers = await db.insert(teamMembers).values(memberData).returning();
  const reef = insertedMembers[0];
  const sharon = insertedMembers[1];
  const gal = insertedMembers[2];
  const zion = insertedMembers[3];
  const casey = insertedMembers[4];
  const morgan = insertedMembers[5];
  const drew = insertedMembers[6];
  const jamie = insertedMembers[7];
  const quinn = insertedMembers[8];

  const today = new Date();

  const guestData = [
    {
      name: "Dr. Sarah Chen",
      phone: "+972-50-123-4567",
      email: "sarah.chen@example.com",
      shortDescription: "AI researcher and author of 'The Human Algorithm'. Expert in ethical AI.",
      notes: "Met at TechConf 2025. Very enthusiastic about the podcast.",
      status: "confirmed",
      links: ["https://youtube.com/watch?v=example1", "https://sarahchen.com/research"],
      addedBy: reef.id,
    },
    {
      name: "Mike Torres",
      phone: "+972-52-987-6543",
      email: "mike.t@startupworld.io",
      shortDescription: "Serial entrepreneur, founded 3 successful startups in the health-tech space.",
      notes: "Reef met him at a networking event. Available weekdays only.",
      status: "contacted",
      links: ["https://linkedin.com/in/miketorres", "https://techcrunch.com/mike-torres-interview"],
      addedBy: reef.id,
    },
    {
      name: "Noa Levy",
      phone: "+972-54-555-1234",
      email: "noa@creativeminds.co",
      shortDescription: "Creative director and TEDx speaker on design thinking and innovation.",
      notes: "Has a very tight schedule, prefers morning sessions.",
      status: "prospect",
      links: ["https://youtube.com/watch?v=tedx-noa", "https://creativeminds.co/about"],
      addedBy: reef.id,
    },
    {
      name: "James Wright",
      phone: "+1-415-555-0199",
      email: "james@podnetwork.com",
      shortDescription: "Podcast industry veteran, runs the largest podcast network in the US.",
      notes: "Can do remote interview via Zoom. Very flexible with timing.",
      status: "prospect",
      links: ["https://podnetwork.com/about", "https://youtube.com/podnetwork"],
      addedBy: reef.id,
    },
  ];

  const insertedGuests = await db.insert(guests).values(guestData).returning();

  const episodeData = [
    { title: "The Future of Remote Work", description: "Exploring how remote work is reshaping industries", status: "editing", episodeNumber: 41, scheduledDate: format(addDays(today, -3), "yyyy-MM-dd") },
    { title: "AI in Everyday Life", description: "How artificial intelligence is becoming part of our daily routines", status: "recording", episodeNumber: 42, scheduledDate: format(addDays(today, 5), "yyyy-MM-dd"), interviewId: null as string | null },
    { title: "Building Creative Teams", description: "Strategies for assembling and leading creative teams", status: "scheduled", episodeNumber: 43, scheduledDate: format(addDays(today, 12), "yyyy-MM-dd") },
    { title: "The Podcast Economy", description: "Understanding monetization and the business side of podcasting", status: "planning", episodeNumber: 44, scheduledDate: format(addDays(today, 20), "yyyy-MM-dd") },
    { title: "Mental Health at Work", description: "Conversations about workplace wellness and mental health", status: "published", episodeNumber: 40, scheduledDate: format(addDays(today, -14), "yyyy-MM-dd") },
  ];

  const insertedEpisodes = await db.insert(episodes).values(episodeData).returning();

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

  const insertedStudioDates = await db.insert(studioDates).values(studioData).returning();

  const interviewData = [
    {
      guestId: insertedGuests[0].id,
      studioDateId: insertedStudioDates[0].id,
      scheduledDate: format(addDays(today, 5), "yyyy-MM-dd"),
      scheduledTime: "10:00",
      location: "Main Studio",
      status: "confirmed",
      notes: "Dr. Chen confirmed via email. Topic: AI Ethics",
      confirmedBy: sharon.id,
    },
  ];

  const insertedInterviews = await db.insert(interviews).values(interviewData).returning();

  await db.insert(interviewParticipants).values([
    { interviewId: insertedInterviews[0].id, teamMemberId: gal.id, role: "interviewer" },
    { interviewId: insertedInterviews[0].id, teamMemberId: zion.id, role: "interviewer" },
  ]);

  await db.update(episodes).set({ interviewId: insertedInterviews[0].id }).where(sql`id = ${insertedEpisodes[1].id}`);

  const taskData = [
    { episodeId: insertedEpisodes[0].id, assigneeId: casey.id, title: "Final audio edit", status: "in_progress", dueDate: format(addDays(today, 1), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[0].id, assigneeId: jamie.id, title: "Design episode cover art", status: "todo", dueDate: format(addDays(today, 2), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[0].id, assigneeId: drew.id, title: "Write social media posts", status: "todo", dueDate: format(addDays(today, 3), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: sharon.id, title: "Confirm guest details with Dr. Chen", status: "done", dueDate: format(addDays(today, -1), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: gal.id, title: "Prepare interview questions", status: "in_progress", dueDate: format(addDays(today, 3), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: sharon.id, title: "Book studio session", status: "done", dueDate: format(addDays(today, 1), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[1].id, assigneeId: morgan.id, title: "Set up recording equipment", status: "todo", dueDate: format(addDays(today, 4), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[2].id, assigneeId: reef.id, title: "Identify and reach out to guest", status: "in_progress", dueDate: format(addDays(today, 8), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[2].id, assigneeId: sharon.id, title: "Coordinate studio availability", status: "todo", dueDate: format(addDays(today, 7), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[3].id, assigneeId: reef.id, title: "Initial guest research", status: "todo", dueDate: format(addDays(today, 14), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[3].id, assigneeId: quinn.id, title: "Plan marketing campaign", status: "todo", dueDate: format(addDays(today, 16), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[4].id, assigneeId: casey.id, title: "Final audio mix", status: "done", dueDate: format(addDays(today, -16), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[4].id, assigneeId: drew.id, title: "Publish social media campaign", status: "done", dueDate: format(addDays(today, -13), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[4].id, assigneeId: jamie.id, title: "Episode artwork", status: "done", dueDate: format(addDays(today, -15), "yyyy-MM-dd") },
    { episodeId: insertedEpisodes[4].id, assigneeId: sharon.id, title: "Upload to all platforms", status: "done", dueDate: format(addDays(today, -12), "yyyy-MM-dd") },
  ];

  await db.insert(tasks).values(taskData);

  console.log("Database seeded successfully!");
}
