# EpisodeOS - Podcast Team Hub

## Overview
A simple, focused podcast team coordination tool. Designed for small podcast teams (~8-9 people) who need to sync responsibilities, track episodes through their lifecycle, and manage studio availability from a third-party partner.

## Architecture
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui components, wouter for routing
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack React Query

## Core Features
1. **Dashboard** - Overview of active episodes, guest pipeline (detailed), confirmed recently (2-week shelf), studio dates, team workload
2. **Episodes** - Episode lifecycle management (planning → scheduled → recording → editing → published) with per-episode task assignment
3. **Team** - Team member management with role display and task tracking
4. **Studio Calendar** - Calendar view of studio availability dates that can be added/removed/toggled (available ↔ taken)
5. **Back Office** - Google Drive links & shared resources page for team-wide access

## Data Model
- `teamMembers` - name, role, color, initials, phone, email, responsibilities
- `episodes` - title, description, status, scheduledDate, episodeNumber
- `tasks` - episodeId, assigneeId, title, status, dueDate
- `studioDates` - date, status (available/taken), notes, bookedSlot, participantEmails (JSON)
- `episodeFiles` - episodeId, name, category (graphic/thumbnail/document), objectPath, contentType, size
- `episodeShorts` - episodeId, title, objectPath, status (pending/approved/rejected), notes, approvedBy
- `sharedLinks` - title, url, description, category (google-drive/general/tools/templates)

## Integrations
- **Google Calendar** - Connected via Replit connector. Creates calendar events with attendees when studio slots are booked. Client module at `server/google-calendar.ts`.
- **Object Storage** - Replit's built-in object storage for file uploads. Presigned URL upload flow. Module at `server/replit_integrations/object_storage/`.

## API Endpoints
- `GET/POST /api/team-members`, `PATCH/DELETE /api/team-members/:id`
- `GET/POST /api/episodes`, `PATCH/DELETE /api/episodes/:id`
- `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/studio-dates`, `PATCH/DELETE /api/studio-dates/:id`
- `GET/POST /api/episodes/:episodeId/files`, `DELETE /api/episode-files/:id`
- `GET/POST /api/episodes/:episodeId/shorts`, `PATCH/DELETE /api/episode-shorts/:id`
- `POST /api/uploads/request-url` - Get presigned URL for file upload
- `GET/POST /api/shared-links`, `PATCH/DELETE /api/shared-links/:id`
- `POST /api/calendar-event` - Creates a Google Calendar event with attendees

## Running
- `npm run dev` starts both the Express backend and Vite frontend dev server
- `npm run db:push` pushes schema changes to the database
