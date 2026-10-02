import { describe, expect, test } from "bun:test";

import { MAX_WIRE_UDP_PAYLOAD, splitCoalescedLiteNetLibDatagram } from "./coalesced.ts";

/** A channeled LiteNetLib datagram of exactly `length` bytes, its body filled with `fill`. */
function channeled(sequence: number, length: number, options: { channel?: number; header?: number; fill?: number } = {}): Buffer {
  const datagram = Buffer.alloc(length, options.fill ?? 0x5a);
  datagram[0] = options.header ?? 0x01;
  datagram.writeUInt16LE(sequence, 1);
  datagram[3] = options.channel ?? 2;
  return datagram;
}

function burst(sequences: number[], length: number, lastLength = length): Buffer {
  return Buffer.concat(sequences.map((sequence, index) =>
    channeled(sequence, index === sequences.length - 1 ? lastLength : length)));
}

describe("splitCoalescedLiteNetLibDatagram", () => {
  test("splits a URO burst back into its equal-length datagrams", () => {
    // The observed shape: seven 1022-byte channeled datagrams delivered as one 7154-byte receive.
    const segments = splitCoalescedLiteNetLibDatagram(burst([99, 100, 101, 102, 103, 104, 105], 1022));
    expect(segments?.map((segment) => segment.length)).toEqual(Array(7).fill(1022));
    expect(segments?.map((segment) => segment.readUInt16LE(1))).toEqual([99, 100, 101, 102, 103, 104, 105]);
  });

  test("keeps a shorter final datagram", () => {
    const segments = splitCoalescedLiteNetLibDatagram(burst([10, 11, 12], 1022, 300));
    expect(segments?.map((segment) => segment.length)).toEqual([1022, 1022, 300]);
  });

  test("tolerates a sequence retransmitted outside the burst", () => {
    const segments = splitCoalescedLiteNetLibDatagram(burst([22, 23, 25, 26], 1022));
    expect(segments?.map((segment) => segment.readUInt16LE(1))).toEqual([22, 23, 25, 26]);
  });

  test("follows sequences across the 16-bit wrap", () => {
    const segments = splitCoalescedLiteNetLibDatagram(burst([0xfffe, 0xffff, 0, 1], 1022));
    expect(segments?.map((segment) => segment.readUInt16LE(1))).toEqual([0xfffe, 0xffff, 0, 1]);
  });

  test("leaves any payload that fits in one datagram untouched", () => {
    // Two segments that happen to line up are still one real datagram at this size.
    const payload = burst([40, 41], MAX_WIRE_UDP_PAYLOAD / 2);
    expect(payload.length).toBe(MAX_WIRE_UDP_PAYLOAD);
    expect(splitCoalescedLiteNetLibDatagram(payload)).toBeUndefined();
  });

  test("leaves an oversized payload untouched when no segment size lines up", () => {
    expect(splitCoalescedLiteNetLibDatagram(Buffer.alloc(4000, 0xc3))).toBeUndefined();
    expect(splitCoalescedLiteNetLibDatagram(channeled(7, 4000, { fill: 0 }))).toBeUndefined();
  });

  test("rejects segments that change channel or connection", () => {
    const mixedChannel = Buffer.concat([channeled(1, 1022), channeled(2, 1022, { channel: 3 })]);
    expect(splitCoalescedLiteNetLibDatagram(mixedChannel)).toBeUndefined();
    const mixedConnection = Buffer.concat([channeled(1, 1022), channeled(2, 1022, { header: 0x21 })]);
    expect(splitCoalescedLiteNetLibDatagram(mixedConnection)).toBeUndefined();
  });

  test("rejects sequences that stall or jump past the reliable window", () => {
    expect(splitCoalescedLiteNetLibDatagram(burst([5, 5], 1022))).toBeUndefined();
    expect(splitCoalescedLiteNetLibDatagram(burst([5, 70], 1022))).toBeUndefined();
  });

  test("accepts fragmented channeled datagrams in the burst", () => {
    const payload = Buffer.concat([channeled(1, 1022, { header: 0x81 }), channeled(2, 1022, { header: 0x81 })]);
    expect(splitCoalescedLiteNetLibDatagram(payload)?.length).toBe(2);
  });
});
