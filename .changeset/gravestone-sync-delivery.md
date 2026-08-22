---
"@kar-mi/spirit-vale-tools-capture": patch
---

`decodeBossGravestone` now reads the marker's `_killInfo` from a standalone SyncType as well as from a spawn's `spawnSyncEntries`.

Creating a gravestone spawns the object carrying none of its fields and sends them straight after in a SyncType on the same object; only a marker already standing carries them in the spawn. Reading spawn entries alone therefore resolved every gravestone except the one the player had just made.

Callers offering only `objectSpawn` packets see no behaviour change, but should now offer SyncTypes too.
