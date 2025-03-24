/**
 * 主入口脚本
 */
document.addEventListener('DOMContentLoaded', function() {
    // 获取关键信息
    const roomId = document.querySelector('meta[name="room-id"]')?.content;
    const currentUserId = document.querySelector('meta[name="current-user-id"]')?.content;
    
    if (!roomId || !currentUserId) {
        console.error('缺少必要的房间或用户信息');
        return;
    }
    
    // 设置全局错误处理
    window.addEventListener('error', function(event) {
        console.error('Global error caught:', event.error);
        // 检查是否是Chart.js相关的错误
        if (event.filename && (
            event.filename.includes('chart.js') || 
            event.filename.includes('chartjs') || 
            event.message.includes('Chart')
        )) {
            console.error('Chart.js related error detected');
            // 重置图表区域并显示错误消息
            const scoreCharts = document.getElementById('score-charts');
            if (scoreCharts) {
                scoreCharts.innerHTML = '<p>图表加载失败，请刷新页面重试。如果问题持续存在，请联系管理员。</p>';
            }
        }
    });
    
    // 初始化加载状态跟踪
    window.chartLoadingState = {
        chartJsLoaded: typeof Chart !== 'undefined',
        annotationLoaded: typeof ChartAnnotation !== 'undefined',
        loadingStarted: false,
        loadingFailed: false,
        retryCount: 0
    };
    
    // 初始化房间管理
    if (window.RoomManager) {
        window.RoomManager.initRoomManager(roomId, currentUserId);
    }
    
    // 初始化日志管理
    if (window.LogsManager) {
        window.LogsManager.initLogs(roomId, currentUserId);
    }
    
    // 初始化图表管理
    if (window.ChartManager) {
        window.ChartManager.initScoreCharts(roomId, currentUserId);
    }
}); 