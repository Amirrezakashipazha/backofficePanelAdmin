import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listFiles(dir) {
  let results = [];
  const list = await fs.readdir(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      const subdir = await listFiles(filePath);
      results = results.concat(subdir);
    } else {
      results.push(filePath);
    }
  }
  return results;
}

async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.error("Error deleting file:", err);
  }
}

export { listFiles, deleteFile, __dirname, path };
