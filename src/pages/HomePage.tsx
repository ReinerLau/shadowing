import { Button, Spin, Row, Col } from "antd";
import { useEffect, useRef, useState } from "react";
import ImportVideo from "../components/ImportVideo";
import VideoCard from "../components/VideoCard";
import MediaDatabaseService from "../services/mediaDatabase";
import SessionStorageService from "../services/sessionStorage";
import type { MediaFile } from "../types";
import { Dialog, NoticeBar } from "antd-mobile";
import packageJson from "../../package.json";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * 首页组件
 */
function HomePage() {
  /** 视频列表 */
  const [videos, setVideos] = useState<MediaFile[]>([]);
  /** 加载状态 */
  const [loading, setLoading] = useState(true);
  /** 存储使用量 */
  const storageUsageRef = useRef<number | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  /**
   * 获取所有视频
   */
  const fetchVideos = async () => {
    try {
      setLoading(true);
      const allVideos = await MediaDatabaseService.getAllVideos();

      // 检查是否支持 File System Access API
      if ("showOpenFilePicker" in window) {
        // 支持时，显示所有视频
        setVideos(allVideos);
      } else {
        // 不支持时，只显示 sessionStorage 中存在的视频
        const availableIds = SessionStorageService.getAvailableVideoIds();
        const filteredVideos = allVideos.filter((video) =>
          availableIds.includes(video.id)
        );
        setVideos(filteredVideos);
      }
    } catch {
      setVideos([]);
      // 错误处理
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算当前域名下的存储使用量
   * @returns {Promise<number | null>} 存储使用信息
   */
  async function getStorageUsage() {
    if (!navigator.storage.estimate) {
      return null;
    }
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage; // 已使用字节数

    if (!usage) {
      return null;
    }

    storageUsageRef.current = Number((usage / 1024 / 1024).toFixed(2));
  }

  const handleMoreClick = () => {
    Dialog.show({
      title: `v${packageJson.version}`,
      closeOnMaskClick: true,
      closeOnAction: true,
      actions: [
        {
          key: "clearCache",
          text: `清理缓存${
            storageUsageRef.current ? `(${storageUsageRef.current}MB)` : ""
          }`,
          onClick: handleClearCache,
          danger: true,
        },
      ],
    });
  };

  const handleClearCache = async () => {
    sessionStorage.clear();
    await MediaDatabaseService.clearDatabase();
    fetchVideos();
    getStorageUsage();
  };

  useEffect(() => {
    fetchVideos();
    getStorageUsage();
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      {/* header */}
      <div className="p-3 flex justify-between bg-white ">
        {/* 更多操作 */}
        <Button
          type="text"
          shape="circle"
          icon={<div className="i-mdi-dots-vertical text-xl" />}
          onClick={handleMoreClick}
        />
        {/* 导入视频 */}
        <ImportVideo />
      </div>
      {needRefresh && (
        <NoticeBar
          content="有新版本可用"
          color="info"
          extra={
            <div className="space-x-1">
              <Button
                color="default"
                variant="text"
                onClick={() => setNeedRefresh(false)}
              >
                忽略
              </Button>
              <Button
                color="primary"
                variant="filled"
                onClick={() => updateServiceWorker(true)}
              >
                更新
              </Button>
            </div>
          }
        />
      )}
      {/* 视频列表 */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spin />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="i-mdi-video-plus text-6xl text-gray-300 mb-4" />
            <div className="text-gray-500">暂无视频，请导入视频</div>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {videos.map((video) => (
              <Col key={video.id} xs={24} sm={12} md={8} lg={6}>
                <VideoCard
                  video={video}
                  onVideoDeleted={() => {
                    fetchVideos();
                    getStorageUsage();
                  }}
                />
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}

export default HomePage;
