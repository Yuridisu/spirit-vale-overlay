/**
 * The largest UDP payload one datagram carries on a standard 1500-byte Ethernet MTU.
 *
 * Anything larger cannot have crossed the wire as a single datagram: the IPv4 parser already
 * discards IP fragments, so an oversized payload is one Windows assembled on receive.
 */
export const MAX_WIRE_UDP_PAYLOAD = 1472;

const PROPERTY_MASK = 0x1f;
const CONNECTION_MASK = 0x60;
const CHANNELED_PROPERTY = 1;
const CHANNELED_HEADER_LENGTH = 4;
const MIN_SEGMENT_LENGTH = CHANNELED_HEADER_LENGTH + 1;
/** LiteNetLib's reliable window; a later datagram in one burst never runs further ahead than this. */
const RELIABLE_WINDOW = 64;

/**
 * Splits a UDP payload that Windows UDP Receive Offload (URO) coalesced back into its datagrams.
 *
 * URO merges a burst of same-flow datagrams into one receive before Npcap sees it, and the
 * capture carries no record of the segment size. Every segment but the last has the same length,
 * so the size is recovered by finding the one at which each segment opens with a channeled header
 * on the same connection and channel, with sequences advancing inside the reliable window. A
 * burst is where a large reliable message such as `LoadCharacter_T` arrives, so decoding only the
 * first segment silently loses the rest of it.
 *
 * Returns undefined for any payload that fits in one datagram or matches no segment size, so the
 * caller decodes it unchanged.
 */
export function splitCoalescedLiteNetLibDatagram(payload: Buffer): Buffer[] | undefined {
  if (payload.length <= MAX_WIRE_UDP_PAYLOAD) return undefined;
  for (let size = MIN_SEGMENT_LENGTH; size <= MAX_WIRE_UDP_PAYLOAD; size += 1) {
    if (isChanneledRun(payload, size)) return segments(payload, size);
  }
  return undefined;
}

function isChanneledRun(payload: Buffer, size: number): boolean {
  const first = payload[0]!;
  if ((first & PROPERTY_MASK) !== CHANNELED_PROPERTY) return false;
  const connection = first & CONNECTION_MASK;
  const channel = payload[3];
  let previous = payload.readUInt16LE(1);
  for (let offset = size; offset < payload.length; offset += size) {
    if (payload.length - offset < CHANNELED_HEADER_LENGTH) return false;
    const header = payload[offset]!;
    if ((header & PROPERTY_MASK) !== CHANNELED_PROPERTY || (header & CONNECTION_MASK) !== connection) return false;
    if (payload[offset + 3] !== channel) return false;
    const sequence = payload.readUInt16LE(offset + 1);
    const step = (sequence - previous + 0x1_0000) & 0xffff;
    if (step < 1 || step > RELIABLE_WINDOW) return false;
    previous = sequence;
  }
  return true;
}

function segments(payload: Buffer, size: number): Buffer[] {
  const result: Buffer[] = [];
  for (let offset = 0; offset < payload.length; offset += size) {
    result.push(payload.subarray(offset, Math.min(offset + size, payload.length)));
  }
  return result;
}
