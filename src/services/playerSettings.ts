import { PlayModeValues, type PlayMode } from "../types";

/**
 * localStorage 键名
 */
const PLAYER_SETTINGS_KEY = "shadow-read-player-settings";

/**
 * 播放器设置接口
 */
export interface PlayerSettings {
  /** 播放模式 */
  playMode: PlayMode;
  /** 播放速度 */
  playbackSpeed: number;
  /** 字幕模糊状态 */
  subtitleBlurred: boolean;
  /** 测验模式状态 */
  quizMode: boolean;
}

/**
 * 默认播放器设置
 */
const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  playMode: PlayModeValues.OFF,
  playbackSpeed: 1.0,
  subtitleBlurred: false,
  quizMode: false,
};

/**
 * 播放器设置服务类
 * 用于管理播放器设置的持久化
 */
export class PlayerSettingsService {
  /**
   * 获取播放器设置
   * @returns PlayerSettings 播放器设置对象
   */
  static getPlayerSettings(): PlayerSettings {
    try {
      const data = localStorage.getItem(PLAYER_SETTINGS_KEY);
      if (!data) return { ...DEFAULT_PLAYER_SETTINGS };
      return JSON.parse(data) as PlayerSettings;
    } catch {
      return { ...DEFAULT_PLAYER_SETTINGS };
    }
  }

  /**
   * 保存播放器设置
   * @param settings - 播放器设置对象
   */
  static savePlayerSettings(settings: PlayerSettings): void {
    try {
      localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // 错误处理
    }
  }
}

export default PlayerSettingsService;

