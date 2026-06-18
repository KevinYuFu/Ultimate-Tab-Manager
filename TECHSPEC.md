# Tech Spec — Ultimate Tab Manager

---

## 1. Overview
> One paragraph. What is this product and what problem does it solve?

Ultimate Tab Manager is a Tab Management Google Chrome Extention to help tab horders and others with adhd manage their tabs by allowing them to close them, rename them, and organize them as they desire.
This Tab Manager allows closing many tabs at once while keeping track of these tabs in it's memory and easily navigate and restoring tabs extremely easy. Using this tab manager should feel like using vim or like the ux in a video game.

---

## 2. Goals & Non-Goals

### Goals
> What must this project accomplish? Keep it to 3–5 bullet points.

- Help individuals who likes to have 10+ tabs constantly open reduce their tab count in a meaningful and manageable way.
- Keep tabs stored in and managed in a way that allows easy and fast retrieval

### Non-Goals
> What are you explicitly NOT building (to avoid scope creep)?

- Not a bookmark manager. Does not interact with google chromes bookmarks.

---

## 3. Target Users
> Who is this for? Describe the primary user in 1–2 sentences. (e.g. power users with 50+ tabs, developers, researchers, etc.)

Primary user is someone with more than 8 tabs open at all times. They likely have many tabs open on youtube, redit, or another platform.
The primary user likely multiple tasks a lot of bounces around many different contexts.

---

## 4. Core Features
> List the features in priority order. For each, write a short description of what it does from the user's perspective.

| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Basic Visual | Basic Display with name and hotkeys displayed. No hotkeys or buttons are functional, besides a preferences button which navigates to a new page where the user can select between different themes. |
| P1 | Single Tab Management | Can stash a tab, saving it into the manager. Tabs are displayed in a list and can be re-opened |
| P2 | Edit Tabs | Can edit the names of tabs |
| P3 | Add Bins | A bin is a folder for tabs. Make the UI act like a file manager where new bins can be added, bins can be opened and closed like a drop down displaying the contents within |
| P4 | Multie Stash & Open| Can stash all tabs in a chrome session, saving them into a bin title the date-time. Can select multiple tabs and open them all at once. |

---

## 5. Platform & Distribution
> Where does this run? Check all that apply and fill in details.

- [x] Chrome Extension — Manifest version: `V3`

Distribution:
Chrome Web Store

---

## 6. Tech Stack
> Fill in what you want to use. Leave blank if undecided — we can decide together.

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | TypeScript ||
| UI Framework | React ||
| Styling | Tailwind ||
| Storage | chrome.storage.local | Persists all data locally. UI state managed with React built-ins. |
| Build Tool | Vite ||
| Backend (if any) | n/a | e.g. none, Supabase, custom API |

---

## 7. Architecture

### Folder Structure
```
src/
  components/   # React UI components (Navigator, Bin, Tab, Preferences, etc.)
  services/     # All chrome.tabs and chrome.storage interactions
  themes/       # Theme definitions
  types/        # TypeScript types (Tab, Bin, Settings, etc.)
```

`components/` only handles what things look like. `services/` only handles what things do. A component that wants to stash a tab calls a function from `services/` — it never touches the Chrome API directly.

### Extension Structure
- **Popup** — the entire app. Reads/writes `chrome.storage.local` and calls the `chrome.tabs` API directly.

> Future: A service worker could enable a global "stash current tab" shortcut that works without opening the popup first.

### Data Flow

**Stashing a tab:**
1. Read tab info (URL, title) via `chrome.tabs` API
2. Write to `chrome.storage.local`
3. Close the tab via `chrome.tabs.remove()`
4. Popup closes

**Managing tabs inside the Navigator:**
1. User performs an action (delete, open, rename)
2. Write the change to `chrome.storage.local`
3. React re-renders the list

---

## 8. Data Model
> What data does the app store? Sketch the key objects/entities.

```
Tab {
  id: string
  url: string
  name: string
  favicon: string
  dateAdded: number
  binId: string | null  // null = root level
}

Bin {
  id: string
  name: string
  parentId: string | null  // null = root level; supports nested bins
}
```

---

## 9. UI / UX Notes

#### UX:
The app can be opened using Chrome Extensions Shortcuts. Every feature can be accessed through hotkeys, which allows the user to open the extention, use a hotkey for whatever feature they intend to use, and jobs done.
This workflow should be similar to using vim, where you type a sequence of keys and the intended action happens instantly. The user can choose to move slow in the app, or let it appear then dissapear right away, removing all friction.

#### Design:
Modern, sleek design similar to the "Dark Mode" app, using terminal colour schemes (e.g. VS Code dark themes).

#### Tabs:
Tabs are the tabs saved by the tab manager, saved as a "URL" and "Name". The URL cannot be changed but the name can be.
Tabs can be Edited, and Deleted, and Opened. A tab can be selected. Multiple tabs can be selected.

#### Hotkeys:
| Key | Action |
|-----|--------|
| `S` | Stash current tab |
| `A` | Stash all tabs in this Chrome instance |
| `M` | Open the tab manager in a new tab (larger screen for organizing) |
| `B` | New bin |
| `E` | Edit selected tab name |
| `Backspace` | Delete selected tab or bin |
| `Enter` | Open selected tab(s) |
| `Ctrl-Z` | Undo last action |
| `1-9` | Quickly select item in navigator |

#### Navigator:
The Navigator is where the user view, manages, and opens tabs.
The Navigator acts like a file manager, using bin's as folders and tabs as files.
The File Manager uses a tree view ui, always showing the root, and bins can be opened and closed to view the contents inside.
The user can select multiple tabs using the usual hotkeys shift and ctrl.
The user can click and drag any tab to move them easily
Embedded bins are allowed.
The first 9 items in the current scope are number 1-9. clicking the number select that item: (Eg. the root folder have 4 bins, numbers 1-4, pressing 2 opens the 2nd bin, all items within the bin (say 8 items) are displayed and are number 1-8, pressing 3 selects the 3rd tab and pressing enter opens the tab)

#### Preferences:
The Preferences View is a separate view which allows the user to customize their experience.
Here they can select their theme for the Tab Manager. We can use themese from Vim or some other text editor as pre-existing list, and we can allow custom themes using the same format as what's used for the text editor
There can be other preferences such as: 
- "Close tab after opening"
- "Tabs not in custom bins are removed after a month"
- Customize hotkeys

#### Smart Naming:
There must be a smart naming feature where the app figures out roughly what name to call any given tab. For youtube forexample, it should be the name of the video. If it's an article, the name of the article should be the name.

#### Tab Closing:
When a tab is closed by the app, we grab a name for the tab, then store it in our system.
The tabs are automatically stored in a bin named by the current date.
There are many options on how to close a tab:
- "Close Tab and smartName" - The Snappiest workflow
- "Close Tab and edit" - Allows the user to edit the name and location of the tab before closing it
- "Close all tabs" - Closes all tabs within the chrome instance and dumps them all into a bin using the current date. They are all smartNamed

---

## 10. Permissions & Privacy
> What browser permissions will you request and why? Less is more for user trust.

| Permission | Reason |
|------------|--------|
| `tabs` | Read tab URL, title, and favicon; close tabs programmatically |
| `storage` | Access `chrome.storage.local` to persist all app data |

All data is stored locally. Nothing is sent to any server.

