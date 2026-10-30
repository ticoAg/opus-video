# Delivery: films in the chat, filed in Google Drive

| where | what |
| --- | --- |
| the repo | the kit, the tools, this skill and its lessons, and every film's pack (text: `story.json`, `narration.json`, `narration.timing.json`, `scenes/`) |
| the chat | the finished films, sent with the file tool |
| the user's Google Drive | a folder per film, `opus-video-<title>` (the title without punctuation, e.g. `opus-video-晚安小狐狸`), beside the other film folders: both films, the notes, and the narration audio |

Packs stay in the repo because they are small and keep paying off: the next
film copies their patterns, and their stills (which render without the media)
show whether a kit change altered an existing film. Media never goes into git.

## Steps

1. Commit the pack, then `STORY=<id> pnpm share`: `out/<id>-share.mp4` and
   `out/<id>-release.md`, notes that name the pack's commit.
2. Send both films in the chat with the file tool: the share copy first (for
   phones and chats), then the master `out/<id>.mp4` (about 70 MB for two
   minutes at 1080p).
3. With the Google Drive connector (`mcp__Google_Drive__*` tools):
   - Find where the film folders live: `search_files` for folders whose title
     contains `opus-video-`, and take their parent. If there are none yet,
     ask the user which folder to use.
   - Make `opus-video-<title>` there unless it exists: `create_file` with
     `contentMimeType` `application/vnd.google-apps.folder` and `parentId`.
   - Put the notes in it: `create_file` with `textContent`, `contentMimeType`
     `text/markdown` and `disableConversionToGoogleType: true`.
   - Give the user the folder's link. They drop the two films in, and the
     narration audio if it is not in Drive yet.
   - When the film comes up again, `search_files` with
     `parentId = '<folder id>'` shows what arrived; the sizes should match
     `out/`.

   Without the connector, paste the notes in the chat and name the folder
   the films belong in.
4. Open the PR with the pack (text only). Kit / tool / doc improvements go in
   their own commits; add what you learned to `lessons.md`.

Never ask for keys or tokens in chat.

## Source media

The narration audio and any photographed pages belong to the user, who keeps
them (the narration usually sits in the film's Drive folder). The container
is thrown away after the session, renders and media with it, so deliver
before the session ends. To rebuild or fix a film in a new session, ask the
user to upload the audio in the chat again, and put it back at
`stories/<id>/input-audio/narration.wav`.

## The Google Drive connector

It moves what fits in a message. Use it to find and read a story the user
keeps in Drive (`search_files`, `read_file_content`), to see what a folder
holds, to make folders and add notes (`create_file`), and to share a file
(`share_file`). It cannot carry films or audio. Its uploads and downloads
pass through the conversation as base64, so anything past a few tens of KB
is out of reach.

## Optional: automatic upload (`pnpm drive`)

Not set up: the user chose delivery through the chat. `src/tools/drive.js`
uploads the films, notes and source media through Drive's API, and brings
the media back into a fresh container. It needs `GDRIVE_CLIENT_ID`,
`GDRIVE_CLIENT_SECRET` and `GDRIVE_REFRESH_TOKEN` in the environment.

```bash
pnpm drive                      # sign-in check, and a link per film folder
STORY=<id> pnpm drive push      # films + notes + source media -> opus-video/<id>/ (media under source/)
STORY=<id> pnpm drive pull      # source media back into the pack
```

It signs in through the user's own OAuth client with the scope `drive.file`,
so it sees only the files it created. That means its own `opus-video/` tree,
never the folders above, and never files dropped into its folders by hand.

Setup, if the user ever asks for it:

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
   title bar → Edit), add the three variables, under Network secrets where
   that section is offered, otherwise as environment variables. The network
   must reach `oauth2.googleapis.com` and `www.googleapis.com`. A new session
   picks them up; `pnpm drive` confirms.

## A public page (optional)

For a film to show publicly, the user can create a GitHub Release on the
Release page (agent sessions cannot push tags), with `<id>-release.md` as the
notes and the share copy attached.
