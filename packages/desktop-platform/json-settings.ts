import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { replaceFile } from "@kar-mi/spirit-vale-tools-logging";

export async function loadJsonSettings<T>(
  file: string,
  validate: (candidate: unknown) => T,
  defaults: () => T,
): Promise<T> {
  try {
    return validate(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return defaults();
  }
}

export async function writeJsonFileAtomic(file: string, value: unknown): Promise<void> {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${file}.tmp`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(temporary, contents, "utf8");
  await replaceFile(temporary, file);
}
