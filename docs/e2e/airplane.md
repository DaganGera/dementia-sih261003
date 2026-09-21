# Airplane-mode end-to-end (AT-11)

Automated version: `pnpm --filter app e2e` runs `offline-sync.spec.ts` in two browser contexts, both offline, with pasted code text standing in for the camera. It covers pairing (with the four-digit comparison), sync both ways, a due reminder, one full game with the model choosing levels, the errorless wording check, and the family dashboard.

Manual version on real devices (needs the APK, see `docs/android.md`):

1. Turn on airplane mode on the tablet and the phone. Turn Wi-Fi off on the laptop.
2. Phone (family): choose "A family member". Family: name, schooling, two people. Reminders: one medicine reminder 3 minutes ahead. Share, Pair a device, Start a family circle.
3. Tablet (person): choose "The person who will play". For family, Pair a device: scan the phone's code. Check the same four digits on both screens. Scan the reply on the phone, then scan the last code on the tablet.
4. Phone: Send records, Show all records. Tablet: Receive records, scan.
5. Tablet: the reminder rings and can be confirmed. Play any activity to the end.
6. Tablet: For family, Send records. Phone: Receive records. Home shows the activity and the confirmed reminder.
7. Force-stop both apps and reopen: everything persists.
8. Turn networks back on. Note anything that behaved differently.

Pass rule: steps 1 to 7 complete with no network on any device.
