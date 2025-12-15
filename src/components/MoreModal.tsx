import { Modal, Radio, Switch } from "antd";
import { PlayModeValues, type PlayMode } from "../types";

/**
 * 更多选项弹窗的 Props 类型
 */
interface MoreModalProps {
  /** 弹窗是否打开 */
  open: boolean;
  /** 当前播放模式 */
  playMode: PlayMode;
  /** 播放模式变化回调 */
  onPlayModeChange: (mode: PlayMode) => void;
  /** 当前播放速度 */
  playbackSpeed: number;
  /** 播放速度变化回调 - 供父组件应用速度到视频 */
  onPlaybackSpeedChange: (speed: number) => void;
  /** 字幕模糊状态 */
  subtitleBlurred: boolean;
  /** 字幕模糊状态变化回调 */
  onSubtitleBlurChange: (blurred: boolean) => void;
  /** 测验模式状态 */
  quizMode: boolean;
  /** 测验模式变化回调 */
  onQuizModeChange: (enabled: boolean) => void;
  /** 弹窗关闭回调 */
  onCancel: () => void;
}

/**
 * 更多选项弹窗组件
 * 用于设置播放模式和播放速度
 */
export const MoreModal = ({
  open,
  playMode,
  onPlayModeChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  subtitleBlurred,
  onSubtitleBlurChange,
  quizMode,
  onQuizModeChange,
  onCancel,
}: MoreModalProps) => {
  return (
    <Modal title="更多选项" open={open} onCancel={onCancel} footer={null}>
      <div className="flex flex-col gap-2">
        {/* 播放模式 */}
        <div>播放模式</div>
        <Radio.Group
          block
          value={playMode}
          onChange={(e) => onPlayModeChange(e.target.value as PlayMode)}
          optionType="button"
          buttonStyle="solid"
          options={[
            {
              label: "连续播放",
              value: PlayModeValues.CONTINUOUS_PLAY,
            },
            {
              label: "单句暂停",
              value: PlayModeValues.SINGLE_PAUSE,
            },
            {
              label: "单句循环",
              value: PlayModeValues.SINGLE_LOOP,
            },
          ]}
        />
        {/* 播放速度 */}
        <div>播放速度</div>
        <Radio.Group
          block
          value={playbackSpeed}
          onChange={(e) => onPlaybackSpeedChange(e.target.value as number)}
          optionType="button"
          buttonStyle="solid"
          options={[
            {
              label: "0.6x",
              value: 0.6,
            },
            {
              label: "0.8x",
              value: 0.8,
            },
            {
              label: "1.0x",
              value: 1.0,
            },
          ]}
        />
        {/* 字幕模糊开关 */}
        <div className="mt-4 flex items-center justify-between">
          <span>字幕模糊</span>
          <Switch checked={subtitleBlurred} onChange={onSubtitleBlurChange} />
        </div>
        {/* 测验模式开关 */}
        <div className="mt-4 flex items-center justify-between">
          <span>测验模式</span>
          <Switch checked={quizMode} onChange={onQuizModeChange} />
        </div>
      </div>
    </Modal>
  );
};
