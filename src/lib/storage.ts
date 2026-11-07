import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/* ============================================================
   图片存储适配层:本地目录(演示)与对象存储(生产)同一接口。
   生产环境设 WAKECAT_STORAGE=s3|oss + 对应凭证,即可整体切换,
   业务代码(inspiration / api/img)不感知实现。
   SQLite 是单文件本地库:多实例部署时必须共享同一对象存储,
   且数据库迁移到 PostgreSQL(见 docs/deployment.md)。
   ============================================================ */

export interface ImageStorage {
  put(buf: Buffer, ext: string): Promise<string>; // 返回可访问路径/URL
  get(name: string): Promise<Buffer>;
}

class LocalImageStorage implements ImageStorage {
  private dir = path.join(process.env.WAKECAT_UPLOAD_DIR || path.join(process.cwd(), "data", "uploads"));
  async put(buf: Buffer, ext: string): Promise<string> {
    const id = `img_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, `${id}.${ext}`), buf);
    return `/api/img/${id}.${ext}`;
  }
  async get(name: string): Promise<Buffer> {
    if (!/^[a-z0-9_]+\.(png|jpe?g|webp)$/i.test(name)) throw new Error("bad name");
    return readFile(path.join(this.dir, name));
  }
}

class ObjectImageStorage implements ImageStorage {
  async put(): Promise<string> {
    throw new Error("对象存储适配未配置:设置 WAKECAT_STORAGE 与对象存储凭证后实现此适配器(接口见 ImageStorage)");
  }
  async get(): Promise<Buffer> {
    throw new Error("对象存储适配未配置");
  }
}

export const imageStorage: ImageStorage =
  process.env.WAKECAT_STORAGE && process.env.WAKECAT_STORAGE !== "local"
    ? new ObjectImageStorage()
    : new LocalImageStorage();
