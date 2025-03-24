/**
 * 房间管理功能
 */

// 轮询间隔（毫秒）
const POLLING_INTERVAL = 5000;

// 全局变量
let updateInterval;
let lastUpdateTime = Date.now();

// 初始化房间管理
function initRoomManager(roomId, currentUserId) {
    // 初始化转账模态框
    initTransferModal(roomId, currentUserId);
    
    // 初始化下一局按钮
    initNextRoundButton(roomId);
    
    // 初始化结算按钮
    initSettlementButton(roomId);
    
    // 开始轮询
    startPolling(roomId);
}

// 初始化转账模态框
function initTransferModal(roomId, currentUserId) {
    const userList = document.getElementById('user-list');
    const transferModal = document.getElementById('transfer-modal');
    const closeModal = document.querySelector('.close-modal');
    const cancelTransfer = document.getElementById('cancel-transfer');
    const confirmTransfer = document.getElementById('confirm-transfer');
    const recipientName = document.getElementById('recipient-name');
    const transferAmount = document.getElementById('transfer-amount');
    
    // 检查元素是否存在
    if (!userList || !transferModal || !closeModal || !cancelTransfer || 
        !confirmTransfer || !recipientName || !transferAmount) {
        return;
    }
    
    let selectedUserId = null;
    const isSpectator = document.querySelector('meta[name="is-spectator"]')?.content === 'True';
    const isZeroSum = document.querySelector('meta[name="is-zero-sum"]')?.content === 'True';
    const isOwner = document.querySelector('meta[name="is-owner"]')?.content === 'True';
    
    // 点击用户显示转账模态框
    userList.addEventListener('click', function(event) {
        const userItem = event.target.closest('.user-item');
        if (!userItem) return;

        const userId = userItem.dataset.userId;
        const username = userItem.dataset.username;

        // 观众不能进行转账操作
        if (isSpectator) return;

        // 零和游戏场景：
        // 1. 房主点击自己不显示转账
        // 2. 普通用户可以给其他人转账（不能给自己）
        if (isZeroSum) {
            if (isOwner) {
                // 房主点击自己不显示转账
                if (userId === currentUserId) return;
            } else {
                // 普通用户点击自己不显示转账
                if (userId === currentUserId) return;
            }
        } else {
            // 非零和游戏，只有房主可以调整积分
            if (!isOwner) return;
        }

        selectedUserId = userId;
        recipientName.textContent = username;
        
        // 根据游戏类型更新模态框标题和输入标签
        const modalTitle = document.querySelector('#transfer-modal h2');
        const amountLabel = document.querySelector('#transfer-modal label[for="transfer-amount"]');
        
        if (isZeroSum) {
            modalTitle.textContent = `转账给 ${username}`;
            amountLabel.textContent = '转账金额';
            transferAmount.min = '1';
        } else {
            modalTitle.textContent = `修改 ${username} 的积分`;
            amountLabel.textContent = '积分变化（正数增加，负数减少）';
            transferAmount.min = '-999999';  // 允许负值
        }
        
        transferModal.style.display = 'block';
        transferAmount.focus();
    });
    
    // 关闭模态框函数
    function closeTransferModal() {
        transferModal.style.display = 'none';
        selectedUserId = null;
    }
    
    // 绑定关闭事件
    closeModal.addEventListener('click', closeTransferModal);
    cancelTransfer.addEventListener('click', closeTransferModal);
    
    // 提交转账
    confirmTransfer.addEventListener('click', function() {
        const amount = parseInt(transferAmount.value, 10);
        if (isNaN(amount)) {
            alert('请输入有效金额');
            return;
        }
        
        // 零和游戏只允许正数金额
        if (isZeroSum && amount <= 0) {
            alert('请输入大于0的金额');
            return;
        }
        
        fetch('/transfer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `room_id=${encodeURIComponent(roomId)}&from_user_id=${encodeURIComponent(currentUserId)}&to_user_id=${encodeURIComponent(selectedUserId)}&amount=${encodeURIComponent(amount)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 更新UI显示
                updateScores(data.users);
                closeTransferModal();
                lastUpdateTime = Date.now();
                
                // 更新按钮状态
                const nextRoundBtn = document.getElementById('next-round');
                const settlementBtn = document.getElementById('settlement');
                
                if (nextRoundBtn && 'can_next_round' in data) {
                    nextRoundBtn.disabled = !data.can_next_round;
                }
                
                if (settlementBtn && 'can_settle' in data) {
                    settlementBtn.disabled = !data.can_settle;
                }

                // 更新round和settle_round信息
                if ('round' in data) {
                    window.currentRound = data.round;
                }
                if ('settle_round' in data) {
                    window.currentSettleRound = data.settle_round;
                }
            } else {
                alert('操作失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error during transfer:', error);
            alert('操作过程中出错，请重试');
        });
    });
}

// 初始化下一局按钮
function initNextRoundButton(roomId) {
    const nextRoundBtn = document.getElementById('next-round');
    if (!nextRoundBtn) return;
    
    nextRoundBtn.addEventListener('click', function() {
        fetch('/next_round', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `room_id=${encodeURIComponent(roomId)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateScores(data.users);
                
                // 更新按钮状态
                if ('can_next_round' in data) {
                    nextRoundBtn.disabled = !data.can_next_round;
                }
                
                const settlementBtn = document.getElementById('settlement');
                if (settlementBtn && 'can_settle' in data) {
                    settlementBtn.disabled = !data.can_settle;
                }
            } else {
                alert('操作失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('操作失败，请重试');
        });
    });
}

// 初始化结算按钮
function initSettlementButton(roomId) {
    const settlementBtn = document.getElementById('settlement');
    if (!settlementBtn) return;
    
    settlementBtn.addEventListener('click', function() {
        fetch('/settle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `room_id=${encodeURIComponent(roomId)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 更新分数
                updateScores(data.users);
                
                // 添加新的结算报告
                const reportsDiv = document.getElementById('settlement-reports');
                if (reportsDiv) {
                    const reportDiv = document.createElement('div');
                    reportDiv.className = 'settlement-report';
                    
                    const header = document.createElement('div');
                    header.className = 'settlement-header collapsed';
                    header.textContent = `第${data.settlement_count}次结算报告 (${data.timestamp})`;
                    
                    const content = document.createElement('div');
                    content.className = 'settlement-content collapsed';
                    content.innerHTML = data.report.replace(/\n/g, '<br>');
                    
                    reportDiv.appendChild(header);
                    reportDiv.appendChild(content);
                    reportsDiv.insertBefore(reportDiv, reportsDiv.firstChild);
                    
                    // 在添加新报告后，重新初始化折叠/展开功能
                    if (typeof setupSettlementListeners === 'function') {
                        setupSettlementListeners();
                    }
                }
                
                // 更新按钮状态
                const nextRoundBtn = document.getElementById('next-round');
                if (nextRoundBtn && 'can_next_round' in data) {
                    nextRoundBtn.disabled = !data.can_next_round;
                }
                
                if ('can_settle' in data) {
                    settlementBtn.disabled = !data.can_settle;
                }

                // 更新round和settle_round信息
                window.currentRound = data.round;
                window.currentSettleRound = data.settle_round;
            } else {
                alert('结算失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('结算失败，请重试');
        });
    });
}

// 更新分数和排名
function updateScores(users) {
    const userList = document.getElementById('user-list');
    if (!userList) return;
    
    // 按分数排序
    const sortedUsers = [...users].sort((a, b) => b.score - a.score);
    
    // 获取所有用户项并转换为数组以便排序
    const userItemsArray = Array.from(userList.querySelectorAll('.user-item'));
    
    // 按分数排序用户项
    userItemsArray.sort((a, b) => {
        const userA = users.find(u => u.id === a.dataset.userId);
        const userB = users.find(u => u.id === b.dataset.userId);
        return userB.score - userA.score;
    });
    
    // 重排DOM元素
    userItemsArray.forEach(item => userList.appendChild(item));
    
    // 更新用户信息
    const userItems = userList.querySelectorAll('.user-item');
    userItems.forEach(item => {
        const userId = item.dataset.userId;
        const updatedUser = users.find(u => u.id === userId);
        if (updatedUser) {
            // 更新用户名和房主状态
            const nameElement = item.querySelector('.user-name');
            nameElement.textContent = updatedUser.name;
            if (updatedUser.owner) {
                nameElement.textContent += '👑';
            }
            
            // 更新上局变化
            const lastChange = updatedUser.last_change || 0;
            item.querySelector('.user-last-change').textContent = lastChange > 0 ? `+${lastChange}` : lastChange;
            
            // 更新总积分显示格式
            const scoreElement = item.querySelector('.user-score');
            const lastScore = updatedUser.last_score || updatedUser.score;
            const scoreDiff = updatedUser.score - lastScore;
            
            if (scoreDiff === 0) {
                // 如果没有变化，直接显示总积分
                scoreElement.innerHTML = lastScore;
            } else if (scoreDiff > 0) {
                // 如果增加，显示蓝色增量
                scoreElement.innerHTML = `${lastScore}<span style="color:#3271ae; font-size:80%">+${scoreDiff}</span>`;
            } else {
                // 如果减少，显示红色减量
                scoreElement.innerHTML = `${lastScore}<span style="color:#c12c1f; font-size:80%">-${Math.abs(scoreDiff)}</span>`;
            }
            
            // 更新排名
            const rank = sortedUsers.findIndex(u => u.id === userId) + 1;
            const rankElement = item.querySelector('.user-rank');
            if (rank === 1) rankElement.textContent = '🥇';
            else if (rank === 2) rankElement.textContent = '🥈';
            else if (rank === 3) rankElement.textContent = '🥉';
            else rankElement.textContent = rank;
        }
    });

    // 控制结算报告区域的显示
    const reportsSection = document.getElementById('settlement-reports-section');
    const reports = document.getElementById('settlement-reports');
    if (reportsSection && reports && reports.children.length > 0) {
        reportsSection.style.display = 'block';
        
        // 确保结算报告可以折叠/展开
        if (typeof setupSettlementListeners === 'function') {
            setupSettlementListeners();
        }
    } else if (reportsSection) {
        reportsSection.style.display = 'none';
    }
}

// 开始轮询获取房间数据
function startPolling(roomId) {
    updateInterval = setInterval(() => fetchRoomData(roomId), POLLING_INTERVAL);
}

// 停止轮询
function stopPolling() {
    clearInterval(updateInterval);
}

// 获取房间数据
function fetchRoomData(roomId) {
    fetch(`/get_room_data/${roomId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 检查用户数量是否发生变化，如果变化，重新加载页面
                const currentUserCount = document.getElementById('user-list')?.querySelectorAll('.user-item').length;
                
                if (data.user_count !== currentUserCount) {
                    location.reload();
                } else {
                    // 更新分数
                    updateScores(data.users);
                    
                    // 更新按钮状态
                    const nextRoundBtn = document.getElementById('next-round');
                    const settlementBtn = document.getElementById('settlement');
                    
                    if (nextRoundBtn) {
                        nextRoundBtn.disabled = !data.can_next_round;
                    }
                    
                    if (settlementBtn) {
                        settlementBtn.disabled = !data.can_settle;
                    }
                    
                    // 更新结算报告（如果有变化）
                    if (data.settlement_reports) {
                        const reportsDiv = document.getElementById('settlement-reports');
                        if (reportsDiv) {
                            reportsDiv.innerHTML = '';  // 清除现有报告
                            data.settlement_reports.forEach(report => {
                                const reportDiv = document.createElement('div');
                                reportDiv.className = 'settlement-report';
                                
                                const header = document.createElement('div');
                                header.className = 'settlement-header collapsed';
                                header.textContent = `第${report.count}次结算报告 (${report.timestamp})`;
                                
                                const content = document.createElement('div');
                                content.className = 'settlement-content collapsed';
                                content.innerHTML = report.report.replace(/\n/g, '<br>');
                                
                                reportDiv.appendChild(header);
                                reportDiv.appendChild(content);
                                reportsDiv.insertBefore(reportDiv, reportsDiv.firstChild);
                            });
                            
                            // 在更新报告后，重新初始化折叠/展开功能
                            if (typeof setupSettlementListeners === 'function') {
                                setupSettlementListeners();
                            }
                        }
                    }

                    // 更新round和settle_round信息
                    window.currentRound = data.round;
                    window.currentSettleRound = data.settle_round;
                }
            }
        })
        .catch(error => {
            console.error('Error fetching room data:', error);
        });
}

// 导出函数
window.RoomManager = {
    initRoomManager,
    updateScores,
    startPolling,
    stopPolling
}; 