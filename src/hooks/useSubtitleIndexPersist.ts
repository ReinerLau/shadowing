import { useEffect, useRef } from "react";
import { debounce } from "lodash-es";
import { MediaDatabaseService } from "../services/mediaDatabase";

/**
 * 持久化字幕索引
 * 在页面卸载或组件卸载时保存当前字幕索引到字幕数据中
 * 使用防抖策略,避免高频更新时频繁写入数据库
 * @param mediaId - 媒体ID
 * @param currentSubtitleIndex - 当前字幕索引
 */
export const useSubtitleIndexPersist = (
  mediaId: string | undefined,
  currentSubtitleIndex: number
) => {
  const isFirstRenderRef = useRef(true);

  // 创建防抖函数的 ref,确保在组件生命周期内保持同一个实例
  const debouncedSaveRef = useRef(
    debounce((id: number, index: number) => {
      MediaDatabaseService.updateSubtitleIndex(id, index);
    }, 500)
  );

  useEffect(() => {
    // 如果是首次渲染，标记一下然后直接返回，不执行后续逻辑
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    // 保存防抖函数到局部变量,避免 cleanup 函数中引用过期的 ref
    const debouncedSave = debouncedSaveRef.current;

    // 调用防抖函数
    debouncedSave(Number(mediaId), currentSubtitleIndex);

    // 组件卸载时立即保存最新的索引值
    return () => {
      // 取消待执行的防抖函数
      debouncedSave.cancel();
      // 立即保存最新值
      MediaDatabaseService.updateSubtitleIndex(
        Number(mediaId),
        currentSubtitleIndex
      );
    };
  }, [mediaId, currentSubtitleIndex]);
};
