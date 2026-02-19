# PodSync - Podcast Team Hub

## Overview
A simple, focused podcast team coordination tool. Designed for small podcast teams (~8-9 people) who need to sync responsibilities, track episodes through their lifecycle, and manage studio availability from a third-party partner.

## Architecture
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui components, wouter for routing
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack React Query

## Core Features
1. **Dashboard** - Overview of active episodes, studio dates, team workload
2. **Episodes** - Episode lifecycle management (planning → scheduled → recording → editing → published) with per-episode task assignment
3. **Team** - Team member management with role display and task tracking
4. **Studio Calendar** - Calendar view of studio availability dates that can be added/removed/toggled (available ↔ taken)

## Data Model
- `teamMembers` - name, role, color, initials
- `episodes` - title, description, status, scheduledDate, episodeNumber
- `tasks` - episodeId, assigneeId, title, status, dueDate
- `studioDates` - date, status (available/taken), notes, bookedSlot, participantEmails (JSON)

## Integrations
- **Google Calendar** - Connected via Replit connector. Creates calendar events with attendees when studio slots are booked. Client module at `server/google-calendar.ts`.

## API Endpoints
- `GET/POST /api/team-members`, `DELETE /api/team-members/:id`
- `GET/POST /api/episodes`, `PATCH/DELETE /api/episodes/:id`
- `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/studio-dates`, `PATCH/DELETE /api/studio-dates/:id`
- `POST /api/calendar-event` - Creates a Google Calendar event with attendees

## Running
- `npm run dev` starts both the Express backend and Vite frontend dev server
- `npm run db:push` pushes schema changes to the database
