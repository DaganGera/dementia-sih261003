# Known gaps

Ranked by how much they matter to a person or a juror. Every item is something a reader could otherwise assume works.

1. **No real people.** Nobody has played Hillpath. Game-based results are personal trends or Simulated.
2. **English only.** The plan had 14 languages with tiers; the user chose English only with no native speakers. Family recordings work in any language, but every word on screen is English, and prompts spoken by the device use the device's English voice. Requirements R3, R4 and O3 are met only in structure.
3. **The screening model is trained on synthetic people.** No dataset needing an application was used. Its accuracy for real people is unknown. The stage outlook uses an assumed transition table.
4. **The monthly check is Hillpath's own.** It is not IQCODE, AD8 or any validated instrument, and has not been compared with a clinician's rating. The mood questions follow the PHQ-2 pattern.
5. **Nothing has run on an Android device.** Native alarms, camera scanning, microphone recording and storage inside the Android WebView are untested. Android Studio and JDK 21 are not installed (`docs/android.md`).
6. **QR sync trusts the circle key.** A share is encrypted with the circle key and signed, but if the sender is not in the paired list the signature is checked against a key inside the message, so it proves integrity, not identity. Any device holding the circle key can write any record. The plan's rule that only a device with reminder rights may change reminders is not enforced.
7. **At-rest protection is browser-level.** Ops, keys and recordings are sealed with a non-extractable key held in IndexedDB. A rooted device or a person with the unlocked phone can still use the app. There is no PIN on the family area of the person's tablet; the family link is only a small link.
8. **Recordings do not sync.** Family voice recordings and full-size photos stay on the device where they were made. Small thumbnails sync inside records.
9. **The relay client is not wired.** `apps/relay` is built and tested with an in-memory store and a D1 adapter, but it is not deployed and the app does not call it. Sharing uses moving QR codes only.
10. **The sudden-change rule from play data is modest.** In simulation it caught 22 of 30 episodes. The family checklist is the main path. Play must be frequent for the data rule to work.
11. **No health-worker visit mode, doctor report, FHIR file, voice answers, life story or postcards.** These were P1 or P2 in the plan.
12. **Legal review.** The design follows the ideas of the DPDP Act 2023 and Rule 11 on guardians, but it has had no legal review and must not be used with real patient records.
13. **The hero footage has unconfirmed rights** (`docs/landing-media.md`).
14. **Wording and colour have not been checked by a person with dementia, a caregiver or a clinician.** The elder-simulation pass and TalkBack pass are still to do.
