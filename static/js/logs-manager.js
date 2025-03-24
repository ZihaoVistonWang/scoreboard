/**
 * 用户日志管理功能
 */

// 初始化日志功能
function initLogs(roomId, currentUserId) {
    const showLogsBtn = document.getElementById('show-logs');
    const userLogsSection = document.getElementById('user-logs-section');
    const userLogs = document.getElementById('user-logs');
    
    // 不存在则不初始化
    if (!showLogsBtn || !userLogsSection || !userLogs) {
        return;
    }
    
    // 点击"本局记录"按钮
    showLogsBtn.addEventListener('click', function() {
        if (userLogsSection.style.display === 'none') {
            // 先关闭积分图
            const scoreChartSection = document.getElementById('score-chart-section');
            const showChartBtn = document.getElementById('show-chart');
            
            if (scoreChartSection && scoreChartSection.style.display !== 'none' && showChartBtn) {
                if (window.ChartManager) {
                    window.ChartManager.closeScoreCharts();
                } else {
                    scoreChartSection.style.display = 'none';
                    showChartBtn.textContent = '积分变化图';
                    showChartBtn.classList.remove('active');
                }
            }
            
            // 显示日志区域
            userLogsSection.style.display = 'block';
            showLogsBtn.textContent = '关闭记录';
            showLogsBtn.classList.add('active');
            
            // 获取并显示用户日志
            fetchUserLogs(roomId, currentUserId);
        } else {
            // 隐藏日志区域
            userLogsSection.style.display = 'none';
            showLogsBtn.textContent = '本局记录';
            showLogsBtn.classList.remove('active');
        }
    });
}

// 获取用户日志
function fetchUserLogs(roomId, currentUserId) {
    const userLogs = document.getElementById('user-logs');
    if (!userLogs) return;
    
    userLogs.innerHTML = '<p>加载中...</p>';
    
    fetch(`/get_user_logs/${roomId}/${currentUserId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayUserLogs(data.logs);
                
                // 如果是房主，添加提示
                if (data.is_owner) {
                    const ownerNote = document.createElement('div');
                    ownerNote.className = 'owner-note';
                    ownerNote.innerHTML = '<em>注：作为房主，您可以查看所有玩家的记录</em>';
                    ownerNote.style.fontSize = '80%';
                    ownerNote.style.marginTop = '10px';
                    ownerNote.style.color = '#666';
                    userLogs.appendChild(ownerNote);
                }
            } else {
                userLogs.innerHTML = '<p>暂无记录</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching user logs:', error);
            userLogs.innerHTML = '<p>获取记录时出错</p>';
        });
}

// 显示用户日志
function displayUserLogs(logs) {
    const userLogs = document.getElementById('user-logs');
    if (!userLogs) return;
    
    userLogs.innerHTML = '';
    
    if (!logs || Object.keys(logs).length === 0) {
        userLogs.innerHTML = '<p>暂无记录</p>';
        return;
    }
    
    // 获取当前的结算轮次和回合
    const settleRoundNum = window.currentSettleRound || document.querySelector('meta[name="settle-round"]')?.content || '1';
    const roundNum = window.currentRound || document.querySelector('meta[name="round"]')?.content || '1';
    
    // 构造键名
    const settleRoundKey = `settle_${settleRoundNum}`;
    const roundKey = `round_${roundNum}`;
    
    // 在顶部显示当前轮次信息
    const roundInfo = document.createElement('div');
    roundInfo.className = 'round-info';
    roundInfo.innerHTML = `当前：第${settleRoundNum}轮第${roundNum}局`;
    userLogs.appendChild(roundInfo);
    
    // 遍历所有用户的日志
    let hasAnyLogs = false;
    
    // 获取用户列表
    const userNames = Object.keys(logs);
    
    // 遍历每个用户的日志
    userNames.forEach(userName => {
        const userLogData = logs[userName];
        
        // 检查当前轮次的日志是否存在
        if (userLogData[settleRoundKey] && userLogData[settleRoundKey][roundKey]) {
            let currentLogs = userLogData[settleRoundKey][roundKey];
            
            // 确保currentLogs是数组
            if (!Array.isArray(currentLogs) || currentLogs.length === 0) {
                return; // 跳过这个用户
            }
            
            hasAnyLogs = true;
            
            // 创建用户标题
            const userTitle = document.createElement('div');
            userTitle.className = 'user-log-title';
            userTitle.innerHTML = `<strong>${userName}的记录</strong>`;
            userLogs.appendChild(userTitle);
            
            // 创建日志列表
            const logList = document.createElement('ul');
            logList.className = 'log-list';
            
            currentLogs.forEach(log => {
                const logItem = document.createElement('li');
                logItem.className = 'log-item';
                logItem.innerHTML = log.description;
                
                // 根据类型添加不同的样式
                if (log.type === 'in') {
                    logItem.style.color = '#3271ae'; // 收入颜色
                } else if (log.type === 'out') {
                    logItem.style.color = '#c12c1f'; // 支出颜色
                }
                
                logList.appendChild(logItem);
            });
            
            userLogs.appendChild(logList);
        }
    });
    
    // 如果没有任何日志，显示提示信息
    if (!hasAnyLogs) {
        userLogs.innerHTML += '<p>本局暂无记录</p>';
    }
}

// 导出函数
window.LogsManager = {
    initLogs,
    fetchUserLogs
}; 