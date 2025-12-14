import type { DBSchema } from "idb";

/**
 * 媒体文件数据类型定义
 */
export interface MediaFile {
  /** 视频ID */
  id: number;
  /** 视频名称 */
  name: string;
  /** 文件句柄（使用 File System Access API 时存储） */
  handle?: FileSystemFileHandle | null;
  /** 视频唯一值 */
  uniqueValue?: string | null;
  /** Blob URL 或者 YouTube URL */
  url?: string | null;
  /** 视频第一帧缩略图 (Data URL) */
  thumbnail?: string;
  /** 视频时长格式化字符串 (HH:MM:SS) */
  duration?: string;
  /** 最后播放时间（时间戳毫秒） */
  lastPlayedTime?: number;
}

/**
 * 媒体 IndexedDB 数据库结构定义
 */
export interface MediaDB extends DBSchema {
  videos: {
    key: number;
    value: MediaFile;
    indexes: { uniqueValue: string };
  };
  subtitles: {
    key: number;
    value: Subtitle;
    indexes: { videoId: number };
  };
}

/**
 * 字幕条目类型定义
 */
export interface SubtitleEntry {
  /** 字幕条目索引 */
  index: number;
  /** 开始时间（毫秒） */
  startTime: number;
  /** 结束时间（毫秒） */
  endTime: number;
  /** 精确开始时间（毫秒）(用于单句暂停和单句循环模式) */
  preciseStartTime: number;
  /** 精确结束时间（毫秒）(用于单句暂停和单句循环模式) */
  preciseEndTime: number;
  /** 字幕文本 */
  text: string;
}

/**
 * 字幕数据类型定义
 */
export interface Subtitle {
  /** 字幕条目ID */
  id: number;
  /** 关联的视频ID */
  videoId: number;
  /** 字幕条目数组 */
  entries: SubtitleEntry[];
  /** 创建时间戳 */
  createdAt: number;
  /** 最后播放的字幕索引 */
  lastSubtitleIndex?: number;
}

/**
 * 播放模式常量定义
 */
export const PlayModeValues = {
  /** 关闭 */
  OFF: "off",
  /** 单句暂停 */
  SINGLE_PAUSE: "single-pause",
  /** 单句循环 */
  SINGLE_LOOP: "single-loop",
} as const;

/**
 * 播放模式类型定义
 */
export type PlayMode = (typeof PlayModeValues)[keyof typeof PlayModeValues];
