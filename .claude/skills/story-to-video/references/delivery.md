# Delivery: films in Google Drive, everything else in the repo

| where | what |
| --- | --- |
| the repo | the kit, the tools, this skill and its lessons, and every film's pack (text: `story.json`, `narration.json`, `narration.timing.json`, `scenes/`) |
| Google Drive, `opus-video/<id>/` | the films and their notes, from `pnpm share` |
| Google Drive, `opus-video/<id>/source/` | the pack's source media (`input-audio/`, `input-pictures/`), which git never holds |

Packs stay in the repo because they are small and keep paying off: the next
film copies their patterns, and their stills (which render without the media)
show whether a kit change altered an existing film. The container an agent
works in is thrown away after the session, so source media must reach Drive
too, or the film cannot be rebuilt.

## Commands

```bash
pnpm drive                      # sign-in check, and a link per film folder
STORY=<id> pnpm drive push      # films + notes + source media; prints a link per file
STORY=<id> pnpm drive pull      # source media back into the pack (a fresh container)
```

Push skips files that are unchanged and turns a changed file into a new
version of the one already there, so links people already have keep working.
Uploads go in 8 MiB chunks and resume where they stopped when the
connection drops.

## When Drive is not set up

`pnpm drive` says so. Send the user the share copy and the master with the
file tool, keep going with everything else, and point them at the setup
below. Never ask for keys or tokens in chat.

## One-time setup (the user does this)

`pnpm drive` signs in as the user through their own OAuth client with the
scope `drive.file`: it sees only the files it created, never the rest of
their Drive.

1. [Google Cloud console](https://console.cloud.google.com/): create a project,
   then APIs & Services → Library → enable **Google Drive API**.
2. Google Auth Platform (the OAuth consent screen): user type External, an
   app name and your email. Under Data access, add the scope
   `https://www.googleapis.com/auth/drive.file`. Under Audience, **publish
   the app** (In production). `drive.file` is a non-sensitive scope, so no
   review is needed. An app left in Testing issues tokens that stop working
   after 7 days.
3. Clients → Create client → **Web application**, with the authorised redirect
   URI `https://developers.google.com/oauthplayground`. Keep the client ID and
   secret.
4. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground): the
   gear icon → *Use your own OAuth credentials* → paste the ID and secret.
   Step 1: type the scope above, *Authorize APIs*, and sign in. Step 2:
   *Exchange authorization code for tokens*, then copy the **refresh token**.
5. In the cloud environment's settings (the environment menu in the session's
   title bar → Edit), add `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET` and
   `GDRIVE_REFRESH_TOKEN`, under Network secrets where that section is
   offered, otherwise as environment variables. The network must reach
   `oauth2.googleapis.com` and `www.googleapis.com`. A new session picks them
   up; `pnpm drive` confirms.

Optional: `GDRIVE_ROOT` names the top folder (default `opus-video`). The
folder can be moved anywhere in Drive.

## A public page (optional)

For a film to show publicly, the user can create a GitHub Release on the
Release page (agent sessions cannot push tags), with `<id>-release.md` as the
notes and the share copy attached.
