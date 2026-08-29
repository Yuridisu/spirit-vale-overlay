---
"@kar-mi/spirit-vale-tools-capture": patch
---

A packet waiting to be attributed to the target process is now held for several `netstat` refreshes rather than one.

Neither endpoint of a freshly opened socket has been reported yet, so every connection's first packets are held. One refresh gave them a single chance to land, and since a refresh spawns two processes it often did not: the opening of a connection was discarded on that race, the connect and the authentication with it. Packets given up on are now reported as a warning instead of dropped silently.
