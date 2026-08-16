# Privacy policy

Enno does not collect, transmit, or share any of your personal data.
All of its features run entirely on your device.

## What Enno stores

Enno stores a single focus-session record in your browser's local storage, and only while a session is running:

- Whether a focus session is active.
- The timer end time.

The record also carries an internal schema version number so stored data stays compatible across extension updates.

When the session ends, Enno erases that record.

Nothing else is stored.
That record never leaves your device: it is never synced, uploaded, or shared.

## What Enno does not do

Enno keeps no session history, no usage counters, and no analytics.
The extension makes no network calls of its own.
It contains no analytics, no tracking, and no third-party services, and it uses your system's built-in fonts, not fonts fetched from a CDN.

## Permissions

Enno requests only the permissions it needs to work, and uses each one locally:

- `storage` - holds the focus-session record described above.
- `alarms` - schedules the timer that ends a session.
- `declarativeNetRequest` - blocks distracting sites while a session is running.
- `webNavigation` - detects navigation to a blocked site so it can show the blocked page.

None of these permissions are used to read or transmit personal data.

## Deleting your data

Stopping a running session from the popup erases the record immediately.
You can also remove all stored data by uninstalling the extension:

- Chrome: `chrome://extensions` - Remove.
- Firefox: `about:addons` - the Enno entry - Remove.

Last updated: August 2026.
