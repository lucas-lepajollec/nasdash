import fs from 'fs';

export function preserveCorruptFile(filePath: string, now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const recoveryPath = `${filePath}.corrupt-${timestamp}`;
  fs.copyFileSync(filePath, recoveryPath, fs.constants.COPYFILE_EXCL);
  return recoveryPath;
}
