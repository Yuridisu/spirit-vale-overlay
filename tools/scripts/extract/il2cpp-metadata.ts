/**
 * Minimal reader for Unity IL2CPP `global-metadata.dat` (metadata version 31).
 *
 * Reads only what the RPC-map refresh needs: every type with its methods in declaration order.
 * It works on the file on disk and never touches the running game.
 */
import { readFileSync } from "node:fs";

const METADATA_MAGIC = 0xfab11baf;
const SUPPORTED_VERSION = 31;
const HEADER_STRINGS = 2;
const HEADER_METHODS = 5;
const HEADER_TYPE_DEFINITIONS = 19;
const METHOD_SIZE = 36;
const TYPE_DEFINITION_SIZE = 88;

export interface MetadataType {
  name: string;
  namespace: string;
  /** Method names in declaration order, which is the order FishNet's weaver emitted them in. */
  methods: string[];
}

export function readMetadataTypes(file: string): MetadataType[] {
  const data = readFileSync(file);
  if (data.readUInt32LE(0) !== METADATA_MAGIC) throw new Error(`${file} is not an IL2CPP metadata file`);
  const version = data.readInt32LE(4);
  if (version !== SUPPORTED_VERSION) {
    throw new Error(`unsupported IL2CPP metadata version ${version}; this reader understands ${SUPPORTED_VERSION}`);
  }
  const section = (index: number): { offset: number; size: number } => ({
    offset: data.readUInt32LE(8 + index * 8),
    size: data.readUInt32LE(12 + index * 8),
  });
  const strings = section(HEADER_STRINGS);
  const methods = section(HEADER_METHODS);
  const types = section(HEADER_TYPE_DEFINITIONS);
  if (methods.size % METHOD_SIZE !== 0 || types.size % TYPE_DEFINITION_SIZE !== 0) {
    throw new Error("IL2CPP metadata sections do not match the version 31 record sizes");
  }

  const text = (index: number): string => {
    const start = strings.offset + index;
    return data.toString("utf8", start, data.indexOf(0, start));
  };

  const result: MetadataType[] = [];
  for (let offset = types.offset; offset < types.offset + types.size; offset += TYPE_DEFINITION_SIZE) {
    const methodStart = data.readInt32LE(offset + 36);
    const methodCount = data.readUInt16LE(offset + 64);
    const names: string[] = [];
    for (let index = 0; index < methodCount; index += 1) {
      names.push(text(data.readUInt32LE(methods.offset + (methodStart + index) * METHOD_SIZE)));
    }
    result.push({ name: text(data.readUInt32LE(offset)), namespace: text(data.readUInt32LE(offset + 4)), methods: names });
  }
  return result;
}

/** RPC method names of a NetworkBehaviour in wire order, read from the weaver's `RpcReader___` stubs. */
export function rpcMethodOrder(type: MetadataType): string[] {
  return type.methods.flatMap((method) => {
    const match = /^RpcReader___(.+)___\d+$/.exec(method);
    return match ? [match[1]!] : [];
  });
}
