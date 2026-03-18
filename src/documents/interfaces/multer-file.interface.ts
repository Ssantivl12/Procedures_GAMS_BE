/** Minimal Multer file interface (mirrors Express.Multer.File from @types/multer) */
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  /** Buffer populated when using memoryStorage */
  buffer: Buffer;
  size: number;
}
