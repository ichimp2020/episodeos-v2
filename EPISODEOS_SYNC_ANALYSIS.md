# EpisodeOS Data Sync & Consistency Analysis

## Executive Summary

The app has **no foreign key constraints** in the database schema (only 2 exist for 250+ relationships). All cascade logic is handled manually in delete functions — and it's **inconsistent**.

---

## 🔴 CRITICAL BUGS (Data Loss / Corruption)

### 1. Guest Deletion → Orphaned Episodes
**Status:** PARTIALLY FIXED in backend, FRONTEND NOT HANDLED

**Backend does:**
- Sets `episode.guestId = null` when guest deleted ✓
- Sets `episode.interviewId = null` when interview deleted ✓

**Frontend problem:**
- Episode cards still display old guest name (cached/optimistic UI)
- No warning badge showing "Guest deleted"
- No "Recreate guest" button

**What should happen:**
```
When guest deleted:
1. Backend: Set guestId=null, interviewId=null ✓ (ALREADY DONE)
2. Frontend: Show warning icon on episode card
3. Frontend: Display "Guest removed" instead of name
4. Frontend: Add button "Restore guest from this episode"
```

---

### 2. Interview Deletion → Calendar Events Not Cancelled
**Status:** NOT HANDLED

**Problem:** When interview deleted, any Google Calendar event created for it is NOT cancelled. The timeslot remains marked as busy in everyone's calendar.

**What should happen:**
```
When interview deleted:
1. Check if interview.calendarEventId exists
2. If yes, call Google Calendar API to delete that event
3. Free up the studio date slot
4. Send cancellation notifications to participants
```

---

### 3. Studio Date Cancellation → Interview Orphaned
**Status:** NOT HANDLED

**Problem:** When studio date is marked "available" (cancelled), any interview using that date still shows old date. Calendar event not updated.

**What should happen:**
```
When studio date status changes to "available":
1. Find all interviews using this studioDateId
2. For each interview:
   a. Update interview.scheduledDate = null, scheduledTime = null
   b. Update interview.status = "needs-reschedule"
   c. Cancel old calendar event (if exists)
   d. Send notification to guest about reschedule needed
3. Update episode status if it was "scheduled" → "needs-reschedule"
```

---

### 4. Guest Field Updates → Not Propagated
**Status:** NOT HANDLED

**Problem:** When guest name/email/phone/description changes, it doesn't update:
- Episode titles (many use guest name)
- Interview displays
- Publishing metadata

**What should happen:**
```
When guest fields updated (name, email, phone, description):
1. Backend: Add trigger or handle in updateGuest()
2. Update all interviews WHERE guestId = updatedGuest.id
3. Update all episodes WHERE guestId = updatedGuest.id (title if auto-generated)
4. Update all publishing records that reference those episodes (title)
```

---

## 🟡 UI INCONSISTENCY ISSUES

### 5. Card UI Not Unified

**Problem:** Each page (Guests, Episodes, Scheduling, Publishing, Archived) shows data differently.

**Required uniformity:**
- Guest Card: Name, status badge, contact info, notes preview
- Episode Card: Title, status, date, progress bar (tasks), quick actions
- Interview Card: Guest name, date/time, status, location
- Publishing Card: Episode title, platform icon, status, scheduled date
- All cards should have: hover states, action menu (...), consistent spacing

**Specific inconsistencies found:**
- Guests page: Some have phone, some don't → inconsistent column layout
- Episodes: Status shown as colored badge → Publishing uses different style
- Scheduling: Uses different card design than Episodes

---

### 6. Episode → Publishing Sync Issues

**Problem:** When episode is archived, publishing records still show as active.

**What should happen:**
```
When episode archived:
1. Set all publishing.status = "archived" for that episode
2. Hide from active publishing view
3. Show in archived section only
```

---

### 7. Task Sync to Episode Progress

**Problem:** Episode cards show "0/5" tasks but this may not reflect actual task count or completion status accurately.

**What should happen:**
- Calculate: completedTasks / totalTasks
- Show progress bar on episode card
- Update in real-time when tasks change

---

## 🟢 MISSING FEATURES

### 8. Recreate Guest from Episode
**Problem:** When guest is deleted, no way to restore from episode data.

**Feature needed:**
```
On episode card with guestId = null:
1. Show "Guest removed" badge (warning color)
2. Show "Recreate guest" button
3. Click opens dialog with:
   - Episode title as default name
   - All other fields empty
   - "Create guest and link to episode" button
```

---

### 9. Interview Reschedule → New Calendar Invite

**Problem:** When interview is rescheduled, old calendar invite not cancelled, new one not sent to same people.

**Feature needed:**
```
When interview rescheduled:
1. Cancel old calendar event (if exists)
2. Get list of interviewParticipants for that interview
3. Create new calendar event with same participants
4. Send new invites
```

---

### 10. Team Member Deletion → Task Orphaning

**Problem:** When team member deleted, their assigned tasks still show their name or ID.

**What should happen:**
```
When team member deleted:
1. Set tasks.assigneeId = null for all their tasks
2. Show "Unassigned" badge on those tasks
3. Notify episode owners about unassigned tasks
```

---

## 📊 DATA MODEL ISSUES

### 11. No Foreign Key Constraints

**Current state:** Only 2 FK constraints exist in entire schema.

**Impact:**
- Database can have orphaned records
- No cascade deletes (manually implemented, inconsistent)
- No referential integrity

**Solution:**
Add FK constraints:
```sql
-- In schema.ts
guestId: varchar("guest_id").references(() => guests.id, { onDelete: "set null" }),
episodeId: varchar("episode_id").notNull().references(() => episodes.id, { onDelete: "cascade" }),
-- etc.
```

---

## 🎯 PRIORITY ORDER

### Phase 1: Critical Fixes (Data Safety)
1. Guest deletion → proper warning & recreate button
2. Interview deletion → calendar event cleanup
3. Studio date cancellation → interview cleanup
4. Add FK constraints

### Phase 2: Data Sync
5. Guest field updates → propagate to episodes/interviews
6. Episode archive → sync to publishing
7. Team member deletion → task cleanup

### Phase 3: UI Unification
8. Create shared Card component
9. Apply consistent styling across all pages
10. Add progress bars, status badges uniformly

### Phase 4: Advanced Features
11. Recreate guest from episode
12. Interview reschedule → calendar re-invite
13. Task progress sync to episode card

---

## 🔍 TESTING CHECKLIST

After fixes, verify:

- [ ] Delete guest → episode shows warning, not ghost data
- [ ] Delete guest → can recreate from episode
- [ ] Change guest name → episode title updates
- [ ] Delete interview → calendar event cancelled
- [ ] Cancel studio date → interview shows needs-reschedule
- [ ] Delete team member → tasks show unassigned
- [ ] Archive episode → publishing hidden from active
- [ ] All cards have consistent UI
- [ ] Task progress shows on episode card

---

*Generated: 2026-03-27*