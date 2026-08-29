---
"@kar-mi/spirit-vale-tools-capture": minor
---

`PacketCapture` now reports which connection the game is on: a `connection` event as each one opens and closes, and a `connectionId` getter for the current one.

Consumers previously had to infer this from FishNet's `authenticated`, which arrives once per connection. Losing that one packet left them pinned to a connection the game had already left, discarding everything the live one sent. LiteNetLib announces every connect and disconnect, so no single packet decides it.
