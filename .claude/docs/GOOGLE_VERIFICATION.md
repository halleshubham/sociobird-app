# Google / YouTube verification pack

Everything needed to take SocioBird through (1) Google OAuth app verification and (2) the YouTube API Services audit and quota extension.
State on 2026-11-07: the consent screen is **in production but unverified**.

## What the app requests (after this change)

| Scope | Used by | Sensitivity |
|---|---|---|
| `userinfo.profile`, `userinfo.email` | name, avatar, email of the connected Google account (channel picker) | non-sensitive |
| `youtube.upload` | resumable upload of a scheduled video (`upload/youtube/v3/videos`) and `thumbnails.set` | sensitive |
| `youtube.readonly` | `channels.list` (mine) for the channel name/picture, `videos.list` for statistics of videos published through SocioBird | sensitive |
| `yt-analytics.readonly` | YouTube Analytics `reports.query` for the analytics dashboard | sensitive |

Removed from the request (they were not needed by any call in `youtube.provider.ts`): `youtube`, `youtube.force-ssl`, `youtubepartner`.
Google's own method pages list `youtube.upload` for `thumbnails.set` and `youtube.readonly` for `channels.list` and `videos.list`.
Channels connected before this change keep their wider grant until they reconnect; nothing breaks for them.

Google Business Profile (`business.manage`, `gmb.provider.ts`) is **not** part of this verification: that channel is "coming soon" in the app. Keep it off the consent screen's Data access list unless/until it is launched.

## Code facts the submission relies on (keep them true)

- Disconnecting a YouTube channel revokes the grant at Google (`https://oauth2.googleapis.com/revoke`, `YoutubeProvider.revokeAccess`) and clears `token`/`refreshToken` (`IntegrationService.deleteChannel`).
- Account deletion overwrites stored tokens irreversibly (`IntegrationRepository.deleteIntegrationsForAccount`); it does **not** call Google's revoke endpoint.
- Channel tokens are stored in Postgres as plain columns (no application-level encryption). The privacy page therefore says "in our database, with access limited to the service" and does not claim encryption at rest. Add that claim only if the database volume is encrypted and you can show it.
- Channel name, picture and analytics of published posts stay with the (soft-deleted) channel record until account deletion; the privacy page promises deletion within 7 days on request or after a revocation at Google. That is a manual commitment: do it when asked.
- The privacy page and the terms are at `https://go.sociobird.app/privacy` and `/terms` (source: `apps/frontend/src/app/(app)/(legal)/`). They contain: the Google API Services User Data Policy / Limited Use statement, the YouTube Terms of Service, the Google Privacy Policy and the Google permissions page links.

## Part 1: OAuth app verification (Google Auth Platform)

Do these in the Google Cloud project that owns `YOUTUBE_CLIENT_ID`.

1. **Search Console**: verify the domain `sociobird.app` (DNS TXT record) with the same Google account that owns the Cloud project. `go.sociobird.app` is covered by the domain property.
2. **Branding**
   - App name: `SocioBird`
   - User support email and developer contact: a monitored address
   - Logo: square 120x120 (the SocioBird bird mark)
   - Application home page: `https://sociobird.app/`
   - Privacy policy: `https://go.sociobird.app/privacy`
   - Terms of service: `https://go.sociobird.app/terms`
   - Authorized domains: `sociobird.app`
3. **Audience**: External, In production.
4. **Data access**: add exactly the scopes in the table above and remove the rest (`youtube`, `youtube.force-ssl`, `youtubepartner`, `business.manage`).
5. **Authorized redirect URIs of the Web client** must include `https://go.sociobird.app/integrations/social/youtube` (and the Google sign-in callbacks already in use).
6. Record the **demo video** (below), upload it to YouTube as *Unlisted*, paste the link in the verification form.
7. Paste the **scope justifications** (below). Submit. Reply to reviewer emails within a day; most rejections are about a mismatch between the video, the scopes and the policy text.

### Scope justifications (paste as is)

- **youtube.upload**: SocioBird is a social media scheduler. A user connects their own YouTube channel, writes the title and description, chooses a thumbnail and privacy status, and schedules a video. At the scheduled time our server uploads that video to the user's channel with the YouTube resumable upload endpoint and sets the thumbnail. Without this scope SocioBird cannot publish the videos the user scheduled. We only upload videos the user explicitly scheduled and never touch other content on the channel.
- **youtube.readonly**: After the user connects a channel we read the channel's name and picture (channels.list, mine=true) to show it in the channel picker and to identify the channel when posting, and we read statistics (views, likes, comments) of the videos that were published through SocioBird (videos.list) for the analytics dashboard. We do not read private content that the user did not publish through SocioBird.
- **yt-analytics.readonly**: We read aggregate view and engagement metrics (YouTube Analytics reports.query) for the user's channel to show performance charts in the SocioBird analytics page. The data is shown only to the user and the team members of the same SocioBird account.
- **userinfo.profile, userinfo.email**: To identify the Google account that authorised the connection and show its name and avatar next to the channel.

### Demo video script (3 to 4 minutes, English, screen recording with voice or captions)

1. Show the browser address bar. Open `https://sociobird.app`, point at the privacy and terms links in the footer.
2. Log in to `https://go.sociobird.app`, open **Launches**, click **Add channel**, choose **YouTube**.
3. On Google's consent screen **keep the URL visible with `client_id=` in it** and show every scope line. Click Allow.
4. Pick the channel in the channel picker (shows name and avatar: userinfo + youtube.readonly).
5. Create a post for that channel: video file, title, description, thumbnail, privacy status, schedule for a time two minutes ahead (youtube.upload). Show it publishing on YouTube Studio.
6. Open **Analytics** for the channel and a published video (yt-analytics.readonly, videos.list).
7. Open the channel menu and **Disconnect**. Then open `https://myaccount.google.com/permissions` and show SocioBird is no longer listed.
8. Show the privacy page section "Google user data" and the Limited Use sentence.

## Part 2: YouTube API Services audit and quota extension

Form: "YouTube API Services - Audit and Quota Extension Form" (linked from the YouTube Data API quota page).
Why: a new project has a default allocation of 100 `videos.insert` calls per day and 10,000 units per day for the other endpoints, shared by all customers, and uploads from an unverified project may be forced to private. Confirm both on the form's instructions page before relying on this note.

Prepare:
- The Cloud project number and the OAuth client (same as above).
- The same demo video plus a screen recording that shows how the user disconnects and how data is removed.
- A realistic upload number: count the videos scheduled per day across customers and ask for about 5x that; every upload costs 1,600 units in the older quota model, so state the daily number of uploads you need rather than units.
- Links: privacy policy, terms, the page that tells users how to revoke access (`https://myaccount.google.com/permissions`), contact email.
- Answers for the compliance questions: we do not store YouTube content beyond channel name/picture and analytics of published posts; no ads; no sale of data; no human access except support with permission; tokens revoked and cleared on disconnect.

## Instagram standalone (separate track, Meta)

Not covered here. See the Instagram app verification notes when that track starts.
