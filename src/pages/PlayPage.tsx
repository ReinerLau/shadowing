import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Button, message } from "antd";
import { Dialog } from "antd-mobile";
import { EditModePopup } from "../components/EditModePopup";
import { RecordingPopup } from "../components/RecordingPopup";
import SubtitleList from "../components/SubtitleList";
import { MoreModal } from "../components/MoreModal";
import {
  PlayModeValues,
  type PlayMode,
  type Subtitle,
  type SubtitleEntry,
} from "../types";
import { useMediaInit } from "../hooks/useMediaInit";
import { useSubtitleIndexPersist } from "../hooks/useSubtitleIndexPersist";
import { extractMetadataFromVideoElement } from "../services/videoData";
import MediaDatabaseService from "../services/mediaDatabase";
import PlayerSettingsService from "../services/playerSettings";
import {
  MediaController,
  MediaTimeRange,
  MediaControlBar,
  MediaTimeDisplay,
} from "media-chrome/react";
import YouTubeVideo from "youtube-video-element/react";
import type CustomVideoElement from "youtube-video-element";

/**
 * 播放页组件
 * 用于播放导入的本地视频文件
 */
function PlayPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<CustomVideoElement>(null);

  const {
    videoUrl,
    subtitle: subtitleFromHook,
    savedSubtitleIndex,
    error,
    thumbnail,
  } = useMediaInit(mediaId);
  /** 本地字幕状态，用于在编辑后立即更新 UI */
  const [subtitle, setSubtitle] = useState<Subtitle | undefined>(
    subtitleFromHook
  );
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState<number>(-1);

  const [isMoreModalOpen, setIsMoreModalOpen] = useState<boolean>(false);
  const [playMode, setPlayMode] = useState<PlayMode>(
    PlayModeValues.CONTINUOUS_PLAY
  );
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  /** 编辑模式下的精确时间（毫秒），为 null 时使用原始值 */
  const [editedTime, setEditedTime] = useState<{
    startTime: number;
    endTime: number;
  }>({
    startTime: 0,
    endTime: 0,
  });
  /** 编辑模式下的字幕文本 */
  const [editedText, setEditedText] = useState<string>("");
  /** 字幕模糊状态 */
  const [subtitleBlurred, setSubtitleBlurred] = useState<boolean>(false);
  /** 测验模式状态 */
  const [quizMode, setQuizMode] = useState<boolean>(false);
  /** 是否已初始化设置（用于避免初始化时触发保存） */
  const [isSettingsInitialized, setIsSettingsInitialized] =
    useState<boolean>(false);
  /** 测验模式下当前字幕的模糊状态 */
  const [quizSubtitleBlurred, setQuizSubtitleBlurred] = useState<boolean>(true);
  /** 是否正在拖动进度条 */
  const isSeeking = useRef<boolean>(false);
  /** 录音模式是否显示 */
  const [recordingMode, setRecordingMode] = useState<boolean>(false);

  /**
   * 同步字幕状态，当 hook 返回的字幕数据变化时更新本地状态
   */
  useEffect(() => {
    if (subtitleFromHook) {
      setSubtitle(subtitleFromHook);
    }
  }, [subtitleFromHook]);

  /**
   * 初始化时读取并应用播放器设置
   */
  useEffect(() => {
    const settings = PlayerSettingsService.getPlayerSettings();
    setPlayMode(settings.playMode);
    setPlaybackSpeed(settings.playbackSpeed);
    setSubtitleBlurred(settings.subtitleBlurred);
    setQuizMode(settings.quizMode);
    setIsSettingsInitialized(true);
  }, []);

  /**
   * 应用播放速度到视频元素
   */
  useEffect(() => {
    if (videoRef.current && playbackSpeed) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  /**
   * 监听设置变化并保存到 localStorage
   */
  useEffect(() => {
    // 避免初始化时触发保存
    if (!isSettingsInitialized) return;

    PlayerSettingsService.savePlayerSettings({
      playMode,
      playbackSpeed,
      subtitleBlurred,
      quizMode,
    });
  }, [
    playMode,
    playbackSpeed,
    subtitleBlurred,
    quizMode,
    isSettingsInitialized,
  ]);

  /**
   * 使用二分法查找距离指定时间最近的字幕索引
   * @param entries 字幕条目数组
   * @param targetTime 目标时间（毫秒）
   * @param direction 查找方向：'next' 查找大于目标时间的最近字幕，'previous' 查找小于目标时间的最近字幕
   * @returns 字幕索引，如果没有找到返回 -1
   */
  const findSubtitleIndexByTime = (
    entries: SubtitleEntry[],
    targetTime: number,
    direction: "next" | "previous"
  ): number => {
    let left = 0;
    let right = entries.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const startTime = entries[mid].startTime;

      if (direction === "next") {
        // 查找 startTime > targetTime 的最小索引
        if (startTime > targetTime) {
          result = mid;
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      } else {
        // 查找 startTime < targetTime 的最大索引
        if (startTime < targetTime) {
          result = mid;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }
    }

    return result;
  };

  /**
   * 根据播放模式检查并处理字幕播放逻辑
   * 优先判断是否为编辑模式或录音模式，这两种模式的逻辑与单句暂停相同
   * @param shouldSeekToStart 是否应该跳转到字幕开始位置（播放时为 true，时间更新时为 false）
   * @returns {boolean} 是否应该更新 currentSubtitleIndex
   */
  const checkPlayMode = (shouldSeekToStart: boolean = false): boolean => {
    if (!subtitle || currentSubtitleIndex === -1 || !videoRef.current)
      return true;
    // 如果手动拖动进度条，为了避免字幕空窗期,先等待更新字幕索引完成后再进行播放模式判断
    if (isSeeking.current) {
      return true;
    }

    const currentTimeMs = videoRef.current.currentTime * 1000;
    const currentEntry = subtitle.entries[currentSubtitleIndex];

    // 优先判断编辑模式或录音模式：逻辑与单句暂停相同
    if (editMode || recordingMode) {
      // 在编辑模式下使用编辑后的精确时间，如果没有编辑则使用原始精确时间
      // 在录音模式下使用原始精确时间
      const preciseStartTime =
        editMode && editedTime?.startTime !== undefined
          ? editedTime.startTime
          : currentEntry.preciseStartTime;
      const preciseEndTime =
        editMode && editedTime?.endTime !== undefined
          ? editedTime.endTime
          : currentEntry.preciseEndTime;

      if (shouldSeekToStart) {
        videoRef.current.currentTime = preciseStartTime / 1000;
      }

      // 如果当前时间超过了当前字幕的精确结束时间
      if (currentTimeMs >= preciseEndTime) {
        // 时间更新时：立即暂停
        videoRef.current.pause();
      }
      // 不走其他播放模式
      return false;
    }

    // 单句暂停模式：检查当前字幕是否已播放完毕
    if (playMode === PlayModeValues.SINGLE_PAUSE) {
      if (shouldSeekToStart) {
        videoRef.current.currentTime = currentEntry.preciseStartTime / 1000;
      }
      // 如果当前时间超过了当前字幕的精确结束时间
      if (currentTimeMs >= currentEntry.preciseEndTime) {
        videoRef.current.pause();
      }
      // 不更新 currentSubtitleIndex，保持在当前字幕
      return false;
    }

    // 单句循环模式：检查当前字幕是否已播放完毕
    if (playMode === PlayModeValues.SINGLE_LOOP) {
      // 如果当前时间超过了当前字幕的精确结束时间，跳回到字幕精确开始位置继续播放
      if (currentTimeMs >= currentEntry.preciseEndTime) {
        videoRef.current.currentTime = currentEntry.preciseStartTime / 1000;
      }
      // 不更新 currentSubtitleIndex，保持在当前字幕
      return false;
    }

    return true;
  };

  /**
   * 视频数据加载后提取元数据
   * 在 loadeddata 事件中提取缩略图和时长，然后保存到数据库
   */
  const handleLoadedData = async () => {
    if (!videoRef.current) return;
    if (thumbnail) return;

    // 提取视频元数据
    const metadata = extractMetadataFromVideoElement(videoRef.current);

    // 更新数据库中的视频元数据
    await MediaDatabaseService.updateVideoMetadata(
      Number(mediaId),
      metadata.thumbnail,
      metadata.duration
    );
  };

  /**
   * 视频加载元数据后跳转到保存的字幕索引
   */
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    // 应用播放速度设置（确保视频元素已准备好）
    if (playbackSpeed) {
      videoRef.current.playbackRate = playbackSpeed;
    }

    if (!subtitle || savedSubtitleIndex < 0 || currentSubtitleIndex !== -1)
      return;

    // 跳转到保存的字幕索引
    const savedEntry = subtitle.entries[savedSubtitleIndex];
    videoRef.current!.currentTime = savedEntry.startTime / 1000;
    setCurrentSubtitleIndex(savedSubtitleIndex);
  };

  /**
   * 监听视频播放时间并同步字幕索引
   */
  const handleTimeUpdate = () => {
    if (!subtitle) return;

    const currentTimeMs = videoRef.current!.currentTime * 1000 || 0; // 转换为毫秒

    // 检查播放模式是否允许更新字幕索引
    if (!checkPlayMode()) {
      return;
    }

    // 查找当前时间对应的字幕索引
    const index = subtitle.entries.findIndex(
      (entry: SubtitleEntry) =>
        currentTimeMs >= entry.startTime && currentTimeMs < entry.endTime
    );

    // 字幕之间可能存在空窗, 只有当 index 不是 -1 时才更新 currentSubtitleIndex
    if (index !== -1) {
      setCurrentSubtitleIndex(index);
      isSeeking.current = false;
    }
  };

  /**
   * 处理 seeking 开始事件
   */
  const handleSeeking = () => {
    isSeeking.current = true;
  };

  /**
   * 处理 seeked 结束事件
   */
  const handleSeeked = () => {
    isSeeking.current = true;
  };

  /**
   * 离开页面时保存当前字幕索引
   */
  useSubtitleIndexPersist(mediaId, currentSubtitleIndex);

  /**
   * 监听字幕索引变化，在测验模式下自动重置模糊状态
   */
  useEffect(() => {
    if (quizMode) {
      setQuizSubtitleBlurred(true);
    }
  }, [currentSubtitleIndex, quizMode]);

  /**
   * 上一句 - 跳转到上一个字幕条目的开始时间
   */
  const handlePreviousSubtitle = () => {
    requestAnimationFrame(() => {
      if (!videoRef.current || !subtitle) return;

      let prevIndex: number;
      if (isSeeking.current) {
        // 使用二分法查找
        const currentTimeMs = videoRef.current.currentTime * 1000;
        prevIndex = findSubtitleIndexByTime(
          subtitle.entries,
          currentTimeMs,
          "previous"
        );
        if (prevIndex === -1) return; // 没有上一句
        // 立即更新字幕索引以触发列表滚动
        setCurrentSubtitleIndex(prevIndex);
      } else {
        // 旧逻辑 - 使用函数式更新
        if (currentSubtitleIndex < 1) return;
        prevIndex = currentSubtitleIndex - 1;
        // 立即更新字幕索引以触发列表滚动
        setCurrentSubtitleIndex((prev) => prev - 1);
      }

      const previousEntry = subtitle.entries[prevIndex];
      // 重置 isSeeking 状态
      isSeeking.current = false;
      // 更新视频时间
      videoRef.current!.currentTime = previousEntry.startTime / 1000;
      videoRef.current!.play();
    });
  };

  /**
   * 下一句 - 跳转到下一个字幕条目的开始时间
   */
  const handleNextSubtitle = () => {
    requestAnimationFrame(() => {
      if (!videoRef.current || !subtitle) return;

      let nextIndex: number;
      if (isSeeking.current) {
        // 使用二分法查找
        const currentTimeMs = videoRef.current.currentTime * 1000;
        nextIndex = findSubtitleIndexByTime(
          subtitle.entries,
          currentTimeMs,
          "next"
        );
        if (nextIndex === -1) return; // 没有下一句
        // 立即更新字幕索引以触发列表滚动
        setCurrentSubtitleIndex(nextIndex);
      } else {
        // 旧逻辑 - 使用函数式更新
        if (currentSubtitleIndex === subtitle.entries.length - 1) return;
        nextIndex = currentSubtitleIndex + 1;
        // 立即更新字幕索引以触发列表滚动
        setCurrentSubtitleIndex((prev) => prev + 1);
      }

      const nextEntry = subtitle.entries[nextIndex];
      // 重置 isSeeking 状态
      isSeeking.current = false;
      // 更新视频时间
      videoRef.current!.currentTime = nextEntry.startTime / 1000;
      videoRef.current!.play();
    });
  };

  /**
   * 播放/暂停切换
   */
  const handleTogglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // 单句暂停模式：播放时检查是否需要跳回到当前字幕的开始位置
      checkPlayMode(true);
      videoRef.current.play();
    }
  };

  /**
   * 返回首页
   */
  const handleGoBack = () => {
    navigate("/");
  };

  /**
   * 处理更多按钮点击
   */
  const handleMoreClick = () => {
    setIsMoreModalOpen(true);
  };

  /**
   * 处理更多弹窗关闭
   */
  const handleMoreModalClose = () => {
    setIsMoreModalOpen(false);
  };

  /**
   * 处理字幕点击事件 - 跳转到对应时间
   */
  const handleSubtitleClick = (subtitleIndex: number) => {
    requestAnimationFrame(() => {
      if (!videoRef.current || !subtitle || subtitleIndex === -1) return;
      // 获取对应索引的字幕条目
      const entry = subtitle.entries[subtitleIndex];
      // 更新当前字幕索引
      setCurrentSubtitleIndex(subtitleIndex);
      // 将毫秒转换为秒
      videoRef.current!.currentTime = entry.startTime / 1000;
      videoRef.current!.play();
    });
  };

  /**
   * 处理进入编辑模式
   */
  const handleEnterEditMode = (subtitleIndex: number) => {
    if (!subtitle || subtitleIndex === -1 || !videoRef.current) return;
    const targetEntry = subtitle.entries[subtitleIndex];
    // 初始化编辑时间为原始精确时间
    setEditedTime({
      startTime: targetEntry.preciseStartTime,
      endTime: targetEntry.preciseEndTime,
    });
    // 初始化编辑文本为当前字幕文本
    setEditedText(targetEntry.text);
    // 跳转到对应字幕的开始位置
    videoRef.current.currentTime = targetEntry.startTime / 1000;
    // 暂停播放
    videoRef.current.pause();
    // 更新当前字幕索引
    setCurrentSubtitleIndex(subtitleIndex);
    setEditMode(true);
  };

  /**
   * 处理退出编辑模式
   */
  const handleExitEditMode = () => {
    setEditMode(false);
    // 重置编辑时间
    setEditedTime({
      startTime: 0,
      endTime: 0,
    });
    // 重置编辑文本
    setEditedText("");
  };

  /**
   * 处理时间偏移
   * @param offset 偏移量（毫秒）
   * @param isStartTime 是否是开始时间
   * @param isForward 是否向前偏移
   */
  const handleTimeOffset = (
    offset: number,
    isStartTime: boolean,
    isForward: boolean
  ) => {
    setEditedTime((prev) => {
      const newTime = isStartTime ? prev.startTime! : prev.endTime!;
      const newOffset = isForward ? newTime + offset : newTime - offset;
      return {
        ...prev,
        [isStartTime ? "startTime" : "endTime"]: newOffset,
      };
    });
  };

  /**
   * 处理保存字幕校准（包括时间校准和文本编辑）
   */
  const handleSaveSubtitleEdit = async () => {
    if (!subtitle || currentSubtitleIndex === -1 || !editedTime) return;

    // 验证文本不为空
    const trimmedText = editedText?.trim() ?? "";
    if (trimmedText === "") {
      message.warning("字幕文本不能为空");
      return;
    }

    try {
      // 创建新的字幕条目副本
      const updatedSubtitle = { ...subtitle };
      const currentEntry = updatedSubtitle.entries[currentSubtitleIndex];

      // 更新当前字幕条目的精确时间
      if (editedTime.startTime !== null) {
        currentEntry.preciseStartTime = editedTime.startTime;
      }
      if (editedTime.endTime !== null) {
        currentEntry.preciseEndTime = editedTime.endTime;
      }

      // 更新当前字幕条目的文本
      currentEntry.text = trimmedText;

      // 保存更新后的字幕数据到数据库
      await MediaDatabaseService.updateSubtitle(updatedSubtitle);

      // 更新本地字幕状态以立即反映更改
      setSubtitle(updatedSubtitle);

      // 显示成功提示
      message.success("保存成功");

      // 退出编辑模式
      handleExitEditMode();
    } catch {
      // 错误处理：如果保存失败，显示错误提示
      message.error("保存失败，请重试");
    }
  };

  /**
   * 处理播放速度变化
   */
  const handlePlaybackSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
  };

  /**
   * 处理进入录音模式
   */
  const handleEnterRecordingMode = (subtitleIndex: number) => {
    if (!subtitle || subtitleIndex === -1 || !videoRef.current) return;
    const targetEntry = subtitle.entries[subtitleIndex];
    // 跳转到对应字幕的开始位置
    videoRef.current.currentTime = targetEntry.startTime / 1000;
    // 暂停播放
    videoRef.current.pause();
    // 更新当前字幕索引
    setCurrentSubtitleIndex(subtitleIndex);
    setRecordingMode(true);
  };

  /**
   * 处理退出录音模式
   */
  const handleExitRecordingMode = () => {
    setRecordingMode(false);
  };

  /**
   * 处理字幕更多操作按钮点击
   * @param e 鼠标事件
   * @param subtitleIndex 字幕索引
   */
  const handleSubtitleMoreClick = (
    e: React.MouseEvent,
    subtitleIndex: number
  ) => {
    e.stopPropagation();
    Dialog.show({
      title: "操作",
      closeOnMaskClick: true,
      closeOnAction: true,
      actions: [
        {
          key: "offset",
          text: "校准",
          onClick: () => handleEnterEditMode(subtitleIndex),
        },
        {
          key: "record",
          text: "跟读",
          onClick: () => handleEnterRecordingMode(subtitleIndex),
        },
      ],
    });
  };

  const handleVideoError = () => {
    message.error("视频播放失败，请检查视频文件格式");
  };

  const isYoutubeVideo = videoUrl?.includes("youtube");

  if (error) {
    return (
      <div className="h-dvh flex flex-col bg-gray-50">
        {/* 控制栏 */}
        <div className="p-3 flex justify-between items-center">
          {/* 返回 */}
          <Button
            type="text"
            shape="circle"
            onClick={handleGoBack}
            icon={<div className="i-mdi-arrow-left text-xl" />}
          />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-lg text-red-600">{error || "无法播放视频"}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-dvh flex flex-col bg-gray-50">
        {/* 控制栏 */}
        <div className="p-3 flex justify-between items-center">
          {/* 返回 */}
          <Button
            type="text"
            shape="circle"
            onClick={handleGoBack}
            icon={<div className="i-mdi-arrow-left text-xl" />}
          />
          {/* 更多 */}
          <Button
            type="text"
            shape="circle"
            onClick={handleMoreClick}
            icon={<div className="i-mdi-dots-vertical text-xl" />}
          />
        </div>

        <div className="flex-1 flex overflow-hidden w-full max-sm:flex-col">
          {/* 视频播放器 */}
          <div className="h-full flex-1 bg-black overflow-hidden max-sm:flex-none max-sm:h-auto max-sm:aspect-video">
            <MediaController className="w-full h-full">
              {isYoutubeVideo ? (
                <YouTubeVideo
                  slot="media"
                  ref={videoRef}
                  src={videoUrl}
                  autoplay
                  className="object-contain w-full h-full"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onSeeking={handleSeeking}
                  onSeeked={handleSeeked}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  playsInline
                  crossOrigin="anonymous"
                />
              ) : (
                <video
                  slot="media"
                  ref={videoRef}
                  src={videoUrl}
                  autoPlay
                  className="object-contain w-full h-full"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onSeeking={handleSeeking}
                  onSeeked={handleSeeked}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  playsInline
                  onLoadedData={handleLoadedData}
                  onError={handleVideoError}
                />
              )}
              <MediaControlBar>
                <MediaTimeRange />
                <MediaTimeDisplay showDuration className="px-2" />
              </MediaControlBar>
            </MediaController>
          </div>

          <div className="w-1/3 flex flex-col max-sm:flex-col-reverse max-sm:w-full max-sm:flex-1 max-sm:overflow-hidden">
            {/* 字幕列表 */}
            <div className="p-4 flex-1 overflow-hidden">
              {subtitle && quizMode ? (
                // 测验模式：只显示当前字幕
                <div
                  className="h-full flex items-center justify-center bg-white rounded shadow p-4 relative"
                  onClick={() => setQuizSubtitleBlurred(!quizSubtitleBlurred)}
                >
                  {currentSubtitleIndex !== -1 && (
                    <>
                      <div
                        className="text-center cursor-pointer"
                        // 解决模糊残留问题: https://developers.weixin.qq.com/community/develop/doc/000c6ebfed4b78023b09e27a851800
                        style={{ transform: "translateZ(0)" }}
                      >
                        <span
                          className={`text-xl ${
                            quizSubtitleBlurred && "blur-md"
                          }`}
                        >
                          {subtitle.entries[currentSubtitleIndex].text}
                        </span>
                      </div>
                      {/* 更多操作按钮 */}
                      <Button
                        type="text"
                        size="small"
                        className="absolute top-2 right-2"
                        onClick={(e) =>
                          handleSubtitleMoreClick(e, currentSubtitleIndex)
                        }
                        title="更多操作"
                        icon={<div className="i-mdi-dots-horizontal text-lg" />}
                      />
                    </>
                  )}
                </div>
              ) : (
                // 其他模式：显示字幕列表
                subtitle && (
                  <SubtitleList
                    subtitle={subtitle}
                    currentIndex={currentSubtitleIndex}
                    onSubtitleClick={handleSubtitleClick}
                    onMoreClick={handleSubtitleMoreClick}
                    subtitleBlurred={subtitleBlurred}
                  />
                )
              )}
            </div>
            {/* 操作区域 */}
            <div className="p-3 h-20 flex gap-4 bg-white">
              <Button
                className="flex-1 h-full"
                type="text"
                onClick={handlePreviousSubtitle}
                icon={<div className="i-mdi:skip-previous text-xl" />}
              />
              <Button
                className="flex-1 h-full"
                type="text"
                onClick={handleTogglePlayPause}
                icon={
                  isPlaying ? (
                    <div className="i-mdi-pause text-xl" />
                  ) : (
                    <div className="i-mdi-play text-xl" />
                  )
                }
              />
              <Button
                className="flex-1 h-full"
                type="text"
                onClick={handleNextSubtitle}
                icon={<div className="i-mdi:skip-next text-xl" />}
              />
            </div>
          </div>
        </div>
      </div>
      {/* 更多弹窗 */}
      <MoreModal
        open={isMoreModalOpen}
        onCancel={handleMoreModalClose}
        onPlayModeChange={(mode) => setPlayMode(mode)}
        onPlaybackSpeedChange={(speed) => {
          setPlaybackSpeed(speed);
          handlePlaybackSpeedChange(speed);
        }}
        playMode={playMode}
        playbackSpeed={playbackSpeed}
        subtitleBlurred={subtitleBlurred}
        onSubtitleBlurChange={setSubtitleBlurred}
        quizMode={quizMode}
        onQuizModeChange={setQuizMode}
      />
      {/* 编辑模式 Popup */}
      <EditModePopup
        editMode={editMode}
        editedTime={editedTime}
        editedText={editedText}
        isPlaying={isPlaying}
        onExitEditMode={handleExitEditMode}
        onSaveSubtitleEdit={handleSaveSubtitleEdit}
        onTimeOffset={handleTimeOffset}
        onTextChange={setEditedText}
        onTogglePlayPause={handleTogglePlayPause}
      />
      {/* 录音模式 Popup */}
      <RecordingPopup
        recordingMode={recordingMode}
        onExitRecordingMode={handleExitRecordingMode}
        onTogglePlayPause={handleTogglePlayPause}
      />
    </>
  );
}

export default PlayPage;
