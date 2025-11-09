import { useEffect } from "react";
import { Button } from "antd";
import { Dialog } from "antd-mobile";
import {
  List,
  useDynamicRowHeight,
  useListRef,
  type RowComponentProps,
} from "react-window";
import type { Subtitle } from "../types";

/**
 * 字幕列表组件属性
 */
interface SubtitleListProps {
  /** 字幕数据 */
  subtitle: Subtitle;
  /** 当前字幕索引 */
  currentIndex: number;
  /** 字幕点击回调 - 用于跳转到对应时间 */
  onSubtitleClick?: (subtitleIndex: number) => void;
  /** 进入编辑模式回调 */
  onEnterEditMode?: (subtitleIndex: number) => void;
  /** 进入录音模式回调 */
  onEnterRecordingMode?: (subtitleIndex: number) => void;
  /** 是否对字幕添加模糊滤镜 */
  subtitleBlurred?: boolean;
}

/**
 * 字幕行组件
 */
const SubtitleRow = ({
  index,
  style,
  subtitle,
  currentIndex,
  onSubtitleClick,
  onEnterEditMode,
  onEnterRecordingMode,
  subtitleBlurred,
}: RowComponentProps<{
  subtitle: Subtitle;
  currentIndex: number;
  onSubtitleClick?: (subtitleIndex: number) => void;
  onEnterEditMode?: (subtitleIndex: number) => void;
  onEnterRecordingMode?: (subtitleIndex: number) => void;
  subtitleBlurred?: boolean;
}>) => {
  const entry = subtitle.entries[index];
  const isCurrent = index === currentIndex;

  /**
   * 处理点击事件 - 跳转到字幕对应时间
   */
  const handleClick = () => {
    if (onSubtitleClick) {
      onSubtitleClick(index);
    }
  };

  /**
   * 处理更多操作按钮点击事件
   */
  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    Dialog.show({
      title: "操作",
      closeOnMaskClick: true,
      closeOnAction: true,
      actions: [
        {
          key: "offset",
          text: "校准",
          onClick: handleOffset,
        },
        {
          key: "record",
          text: "跟读",
          onClick: handleRecord,
        },
      ],
    });
  };

  /**
   * 处理偏移操作
   */
  const handleOffset = () => {
    if (onEnterEditMode) {
      onEnterEditMode(index);
    }
  };

  /**
   * 处理录音操作
   */
  const handleRecord = () => {
    if (onEnterRecordingMode) {
      onEnterRecordingMode(index);
    }
  };

  return (
    <div style={style}>
      {/* 字幕条目 */}
      <div
        className={`mb-2 shadow-sm rounded transition-colors duration-200 cursor-pointer select-none flex items-center justify-between px-4 py-4 ${
          isCurrent ? "bg-blue-100 border-l-4 border-blue-500" : "bg-white"
        }`}
        onClick={handleClick}
      >
        <div
          className={`text-sm break-words whitespace-pre-wrap flex-1 ${
            subtitleBlurred ? "blur-sm" : "blur-none"
          }`}
        >
          {entry.text}
        </div>
        {/* 更多操作按钮 */}
        {isCurrent && (
          <Button
            type="text"
            size="small"
            onClick={handleMoreClick}
            title="更多操作"
            icon={<div className="i-mdi-dots-vertical text-lg" />}
          />
        )}
      </div>
    </div>
  );
};

/**
 * 字幕列表组件 - 使用虚拟滚动显示字幕
 * 采用 react-window v2 的 List 和 useDynamicRowHeight 实现动态行高度
 */
function SubtitleList({
  subtitle,
  currentIndex,
  onSubtitleClick,
  onEnterEditMode,
  onEnterRecordingMode,
  subtitleBlurred,
}: SubtitleListProps) {
  const listRef = useListRef(null);

  /**
   * 使用 useDynamicRowHeight hook 管理动态行高
   */
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 80,
  });

  /**
   * 滚动到当前字幕
   */
  useEffect(() => {
    if (!subtitle || !listRef.current) return;

    if (currentIndex !== -1) {
      const rafId = requestAnimationFrame(() => {
        listRef.current?.scrollToRow({
          index: currentIndex,
          align: "center",
          // behavior: "smooth",
        });
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [currentIndex, subtitle, listRef]);

  return (
    <List
      listRef={listRef}
      rowCount={subtitle.entries.length}
      rowHeight={rowHeight}
      rowComponent={SubtitleRow}
      rowProps={{
        subtitle,
        currentIndex,
        onSubtitleClick,
        onEnterEditMode,
        onEnterRecordingMode,
        subtitleBlurred,
      }}
    />
  );
}

export default SubtitleList;
