# EpisodeOS - Voice Of Nova Podcast Team Hub

## Overview
A simple, focused podcast team coordination tool for "Voice Of Nova" podcast. Designed for small podcast teams (~8-9 people) who need to sync responsibilities, track episodes through their lifecycle, and manage studio availability from a third-party partner.

## Architecture
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui components, wouter for routing
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack React Query

## Core Features
1. **Dashboard** - Overview of active episodes, guest pipeline (detailed), confirmed recently (2-week shelf), studio dates, team workload
2. **Episodes** - Episode lifecycle management (scheduled → planning → recording → editing → publishing → archived) with per-episode task assignment, auto-status transitions based on dates
3. **Team** - Team member management with role display and task tracking
4. **Studio Calendar** - Calendar view of studio availability dates that can be added/removed/toggled (available ↔ taken)
5. **Back Office** - Google Drive links & shared resources page for team-wide access

## Data Model
- `teamMembers` - name, role, color, initials, phone, email, responsibilities
- `episodes` - title, description, status, scheduledDate, episodeNumber, requestId (client-generated UUID for idempotent creation)
- `tasks` - episodeId, assigneeId, title, status, dueDate
- `studioDates` - date, status (available/taken), notes, bookedSlot, participantEmails (JSON)
- `episodeFiles` - episodeId, name, category (graphic/thumbnail/document), objectPath, contentType, size
- `episodeShorts` - episodeId, title, objectPath, status (pending/approved/rejected), notes, approvedBy (UI label: "Teasers")
- `episodeLargeLinks` - episodeId, title, url, category (general) — external Drive/Dropbox links for large files
- `sharedLinks` - title, url, description, category (google-drive/general/tools/templates)

## Integrations
- **Google Calendar** - Connected via Replit connector. Creates calendar events with attendees when studio slots are booked. Client module at `server/google-calendar.ts`.
- **Object Storage** - Replit's built-in object storage for file uploads. Presigned URL upload flow. Module at `server/replit_integrations/object_storage/`.
- **AI (OpenAI via Replit)** - Chat conversations with streaming responses. Routes at `server/replit_integrations/chat/routes.ts`. Used for podcast content creation assistance.

## API Endpoints
- `GET/POST /api/team-members`, `PATCH/DELETE /api/team-members/:id`
- `GET/POST /api/episodes`, `PATCH/DELETE /api/episodes/:id`
- `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/studio-dates`, `PATCH/DELETE /api/studio-dates/:id`
- `GET/POST /api/episodes/:episodeId/files`, `DELETE /api/episode-files/:id`
- `GET/POST /api/episodes/:episodeId/shorts`, `PATCH/DELETE /api/episode-shorts/:id`
- `GET/POST /api/episodes/:episodeId/large-links`, `DELETE /api/episode-large-links/:id`
- `POST /api/uploads/request-url` - Get presigned URL for file upload
- `GET/POST /api/episodes/:episodeId/platform-links`, `GET /api/platform-links`, `PATCH/DELETE /api/platform-links/:id`
- `GET/POST /api/shared-links`, `PATCH/DELETE /api/shared-links/:id`
- `POST /api/episodes/auto-status` - Auto-transitions episode statuses based on dates (recording on scheduled date, editing day after, archived after publish date)
- `POST /api/episodes/:id/repair` - Idempotent: creates only missing default tasks for an episode, returns `{ repaired, alreadyPresent }`
- `POST /api/calendar-event` - Creates a Google Calendar event with attendees; supports `previousEventId` to auto-cancel old events on reschedule
- `GET /api/search?q=query` - Cross-entity search (guests, episodes, team, interviews, studio dates)
- `GET/POST /api/conversations`, `GET/DELETE /api/conversations/:id` - AI chat conversations
- `POST /api/conversations/:id/messages` - Send message and stream AI response (SSE)
- `POST /api/ai/quick` - One-off AI prompt with streaming response (SSE)

## Shared Utilities
- `client/src/lib/statusColors.ts` — Episode status colors and translated labels used across all views
- `client/src/lib/rescheduleHelpers.ts` — `needsReschedule()` and `canReschedule()` shared between episodes.tsx and EpisodeEditDialog.tsx

## State Management Patterns
- **Episode detail dialog** (`episodes.tsx`): Uses `selectedEpisodeId` (string state) with derived `selectedEpisode` from query cache. No sync effect needed — always fresh from `episodes.find()`.
- **Studio invite flow** (`studio.tsx`): Master toggle `sendInvites` (OFF by default) + role-based `inviteRecipients` checkboxes (all OFF by default). Invites only sent when master is ON and recipients are selected.

## Dialog Sizing Standards
- **Standard (forms/inputs)**: `max-w-lg w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden`
- **Large (detail views)**: `max-w-[560px] w-[95vw] sm:w-full overflow-x-hidden max-h-[calc(100vh-24px)] flex flex-col p-0` with fixed header (`shrink-0`) and scrollable body (`overflow-y-auto flex-1`)

## Running
- `npm run dev` starts both the Express backend and Vite frontend dev server
- `npm run db:push` pushes schema changes to the database
